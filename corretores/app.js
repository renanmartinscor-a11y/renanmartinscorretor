import { subscribeMember, getMemberState, login, register, verifyEmail, logout } from "/js/wix/member-store.js";
import { wixRequest } from "/js/wix/client.js";

const DONO = "renanmartinscor@gmail.com";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mesAno = (e) => (e && /^\d{4}-\d{2}/.test(e) ? e.slice(5, 7) + "/" + e.slice(0, 4) : e || "");

let DADOS = null, iniciado = false;

/* ---------------- login ---------------- */
function msg(html, tipo = "i") { $("#authMsg").innerHTML = html ? `<div class="msg ${tipo}">${html}</div>` : ""; }
function estado(r) { return (r && (r.state || r.status || r.result)) || ""; }
function tratar(r) {
  const st = estado(r);
  if (st === "SUCCESS") { msg(""); return; }
  if (st === "EMAIL_VERIFICATION_REQUIRED") { mostrarForm("fCod"); msg("Confirme o seu e-mail com o código enviado.", "i"); return; }
  if (st === "OWNER_APPROVAL_REQUIRED") { msg("Cadastro recebido! Aguarde a liberação do acesso.", "ok"); return; }
  const code = r && (r.errorCode || r.error || "");
  if (/exists/i.test(code)) msg("Este e-mail já tem cadastro. Use a aba Entrar.", "e");
  else if (/password|invalid|notFound|wrong/i.test(code)) msg("E-mail ou senha incorretos.", "e");
  else msg("Não foi possível entrar agora. Confira o e-mail e a senha e tente de novo.", "e");
}
function mostrarForm(id) { ["fIn", "fUp", "fCod"].forEach((f) => $("#" + f).classList.toggle("hid", f !== id)); }
$$("[data-a]").forEach((b) => b.addEventListener("click", () => {
  $$("[data-a]").forEach((x) => x.classList.toggle("on", x === b));
  mostrarForm(b.dataset.a === "in" ? "fIn" : "fUp"); msg("");
}));
$("#fIn").addEventListener("submit", async (ev) => {
  ev.preventDefault(); msg("Entrando…");
  try { tratar(await login($("#inEmail").value.trim(), $("#inSenha").value)); } catch (e) { tratar({ errorCode: e?.code || "" }); }
});
$("#fUp").addEventListener("submit", async (ev) => {
  ev.preventDefault(); msg("Enviando…");
  try { tratar(await register($("#upEmail").value.trim(), $("#upSenha").value, { firstName: $("#upNome").value.trim(), lastName: $("#upSob").value.trim() })); }
  catch (e) { tratar({ errorCode: e?.code || "" }); }
});
$("#fCod").addEventListener("submit", async (ev) => {
  ev.preventDefault(); msg("Confirmando…");
  try { tratar(await verifyEmail($("#cod").value.trim())); } catch (e) { tratar({ errorCode: e?.code || "" }); }
});
$("#sair").addEventListener("click", () => logout("/corretores/"));

function emailDo(m) { return (m?.loginEmail || m?.contact?.emails?.[0] || m?.email || "").toLowerCase(); }
function nomeDo(m) {
  const c = m?.contact || {};
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || m?.profile?.nickname || emailDo(m);
}

function render(st) {
  if (st.loading) return;
  $("#carregando").classList.add("hid");
  const on = st.loggedIn && st.member;
  $("#vAuth").classList.toggle("hid", !!on);
  $("#vApp").classList.toggle("hid", !on);
  $("#sair").classList.toggle("hid", !on);
  $("#who").textContent = on ? nomeDo(st.member) : "";
  if (on) {
    $("#tabLeads").classList.toggle("hid", emailDo(st.member) !== DONO);
    const perfil = lerPerfil();
    if (!perfil.nome) { $("#cNome").value = nomeDo(st.member); salvarPerfil(); }
    if (!iniciado) { iniciado = true; iniciar(); }
  }
}
subscribeMember(render);
render(getMemberState());

/* ---------------- abas ---------------- */
$$("#tabs button").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.t)));
function abrirAba(t) {
  $$("#tabs button").forEach((x) => x.classList.toggle("on", x.dataset.t === t));
  $$("[data-p]").forEach((p) => p.classList.toggle("hid", p.dataset.p !== t));
  if (t === "materiais") carregarMateriais();
}

async function iniciar() {
  try { DADOS = await (await fetch("/data/corretores.json", { cache: "no-store" })).json(); }
  catch { $("#bres").innerHTML = '<div class="msg e">Não foi possível carregar os dados agora.</div>'; return; }
  DADOS.emps.forEach((e) => { e._units = DADOS.units.filter((u) => u.emp === e.id); e._min = Math.min(...e._units.map((u) => u.valor).filter((v) => v > 0)); });
  const opts = DADOS.emps.filter((e) => e._units.length).sort((a, b) => a.nome.localeCompare(b.nome))
    .map((e) => `<option value="${e.id}">${esc(e.nome)} (${e._units.length})</option>`).join("");
  $("#tEmp").innerHTML = opts; $("#pEmp").innerHTML = opts;
  $("#bq").addEventListener("input", busca); busca();
  $("#tEmp").addEventListener("change", () => { preencherQ(); tabela(); });
  $("#tQ").addEventListener("change", tabela);
  $("#tPrint").addEventListener("click", () => window.print());
  $("#tCsv").addEventListener("click", csv);
  preencherQ(); tabela();
  const p = lerPerfil(); $("#cNome").value = p.nome || $("#cNome").value; $("#cCreci").value = p.creci || ""; $("#cWpp").value = p.wpp || "";
  ["cNome", "cCreci", "cWpp"].forEach((id) => $("#" + id).addEventListener("input", salvarPerfil));
  $("#pEmp").addEventListener("change", () => { unidades(); });
  $("#pUn").addEventListener("change", fluxos);
  $("#pFx").addEventListener("change", previa);
  ["pCli", "pObs"].forEach((id) => $("#" + id).addEventListener("input", previa));
  $("#pGerar").addEventListener("click", gerarPdf);
  unidades();
  iniciarApres();
}
const emp = (id) => DADOS.emps.find((e) => e.id === id);

/* ---------------- busca por nome ---------------- */
function busca() {
  const q = norm($("#bq").value).split(/\s+/).filter(Boolean);
  const L = DADOS.emps.filter((e) => { const h = norm([e.nome, e.incorp, e.bairro, e.cidade].join(" ")); return q.every((w) => h.includes(w)); })
    .sort((a, b) => a.nome.localeCompare(b.nome));
  $("#bres").innerHTML = L.length ? L.map((e) => `
    <div class="emp">
      <div><b>${esc(e.nome)}</b><br><span class="note">${esc(e.incorp)} · ${esc(e.bairro)}, ${esc(e.cidade)}${e.entrega ? " · entrega " + mesAno(e.entrega) : e.pronto ? " · pronto" : ""}</span><br>
      <span class="tag">${esc(e.status)}</span>${e._units.length ? `<span class="tag">${e._units.length} disponíveis</span><span class="tag">a partir de ${brl(e._min)}</span>` : '<span class="tag">valores sob consulta</span>'}</div>
      <span class="sp"></span>
      ${e._units.length ? `<button class="btn s" data-ver="${e.id}">Tabela</button> <button class="btn o s" data-prop="${e.id}">Proposta</button>` : ""}
      <a class="btn o s" href="${e.url}" target="_blank">Página</a>
    </div>`).join("") : '<p class="note">Nenhum empreendimento com esse nome.</p>';
  $$("[data-ver]").forEach((b) => b.addEventListener("click", () => { $("#tEmp").value = b.dataset.ver; preencherQ(); tabela(); abrirAba("tabelas"); }));
  $$("[data-prop]").forEach((b) => b.addEventListener("click", () => { $("#pEmp").value = b.dataset.prop; unidades(); abrirAba("proposta"); }));
}

/* ---------------- tabelas ---------------- */
function preencherQ() {
  const e = emp($("#tEmp").value); if (!e) return;
  const qs = [...new Set(e._units.map((u) => u.quartos))].sort();
  $("#tQ").innerHTML = '<option value="">Todos</option>' + qs.map((q) => `<option>${esc(q)}</option>`).join("");
}
function linhasTabela() {
  const e = emp($("#tEmp").value), q = $("#tQ").value;
  return e ? e._units.filter((u) => !q || u.quartos === q).sort((a, b) => a.valor - b.valor) : [];
}
function tabela() {
  const e = emp($("#tEmp").value); if (!e) return;
  const L = linhasTabela();
  $("#tHead").innerHTML = `<h2>${esc(e.nome)}</h2><p class="note">${esc(e.incorp)} · ${esc(e.endereco || e.bairro)}${e.entrega ? " · entrega " + mesAno(e.entrega) : ""}<br>${esc(e.tabela)}${e.correcao ? " · " + esc(e.correcao) : ""}</p>`;
  $("#tTab").innerHTML = `<thead><tr><th>Unidade</th><th>Tipologia</th><th class="v">Área (m²)</th><th>Vaga</th><th>Posição</th><th class="v">Valor</th></tr></thead><tbody>` +
    L.map((u) => `<tr><td>${esc(u.un)}</td><td>${esc(u.quartos)}</td><td class="v">${u.area ? Number(u.area).toLocaleString("pt-BR") : "—"}</td><td>${esc(u.vaga)}</td><td>${esc(u.pos)}${u.mar ? ' <span class="tag">face mar</span>' : ""}</td><td class="v">${brl(u.valor)}</td></tr>`).join("") + "</tbody>";
}
function csv() {
  const e = emp($("#tEmp").value); const L = linhasTabela();
  const c = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const out = [["Unidade", "Tipologia", "Área m²", "Vaga", "Posição", "Valor"].map(c).join(";")]
    .concat(L.map((u) => [u.un, u.quartos, String(u.area ?? "").replace(".", ","), u.vaga, u.pos, String(u.valor.toFixed(2)).replace(".", ",")].map(c).join(";")))
    .concat(["", c("Valores podem mudar sem aviso prévio. " + (e.tabela || ""))]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `tabela-${e.id}.csv`; a.click();
}

/* ---------------- proposta ---------------- */
function lerPerfil() { try { return JSON.parse(localStorage.getItem("rm_corretor_v1") || "{}"); } catch { return {}; } }
function salvarPerfil() { try { localStorage.setItem("rm_corretor_v1", JSON.stringify({ nome: $("#cNome").value, creci: $("#cCreci").value, wpp: $("#cWpp").value })); } catch {} }
function unidades() {
  const e = emp($("#pEmp").value); if (!e) return;
  $("#pUn").innerHTML = e._units.slice().sort((a, b) => String(a.un).localeCompare(String(b.un), "pt-BR", { numeric: true }))
    .map((u) => `<option value="${u.id}">${esc(u.un)} · ${esc(u.quartos)} · ${brl(u.valor)}</option>`).join("");
  fluxos();
}
const unid = () => DADOS.units.find((u) => u.id === $("#pUn").value);
function fluxos() {
  const u = unid(); if (!u) return;
  $("#pFx").innerHTML = (u.fluxos || []).map((f, i) => `<option value="${i}">${esc(f.nome)}</option>`).join("") || '<option value="">Sem fluxo cadastrado</option>';
  previa();
}
function htmlProposta(comCabecalho) {
  const e = emp($("#pEmp").value), u = unid(); if (!e || !u) return "";
  const f = (u.fluxos || [])[+$("#pFx").value];
  const hoje = new Date().toLocaleDateString("pt-BR");
  let meses = "";
  if (e.entrega && /^\d{4}-\d{2}/.test(e.entrega)) {
    const d = new Date(), [ay, am] = e.entrega.split("-").map(Number);
    const n = (ay - d.getFullYear()) * 12 + (am - (d.getMonth() + 1));
    meses = n > 0 ? `Hoje é ${hoje}; faltam ${n} meses para a entrega (${mesAno(e.entrega)}).` : `Entrega prevista: ${mesAno(e.entrega)}.`;
  }
  const linhas = f ? f.linhas.map(([rot, qt, val, data]) => {
    const quando = data && !/^#/.test(data) ? data : "";
    return `<tr><td>${esc(rot)}${quando ? " · " + esc(quando) : ""}</td><td class="v">${qt > 1 ? qt + "x de " + brl(val) : brl(val)}</td><td class="v">${brl(qt * val)}</td></tr>`;
  }).join("") : "";
  const total = f ? f.linhas.reduce((s, l) => s + l[1] * l[2], 0) : 0;
  const p = { nome: $("#cNome").value, creci: $("#cCreci").value, wpp: $("#cWpp").value };
  return `${comCabecalho ? `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #C29A4E;padding-bottom:10px;margin-bottom:16px"><h1 style="margin:0;color:#13233F">Proposta / simulação</h1><span style="font-size:13px;color:#555">${hoje}</span></div>` : ""}
  ${$("#pCli").value ? `<p><b>Cliente:</b> ${esc($("#pCli").value)}</p>` : ""}
  <h2 style="color:#13233F;margin:6px 0">${esc(e.nome)}</h2>
  <p style="font-size:13px;color:#555;margin:0 0 10px">${esc(e.incorp)} · ${esc(e.endereco || e.bairro + ", " + e.cidade)}</p>
  <table><tbody>
    <tr><td><b>Unidade</b></td><td>${esc(u.un)}</td></tr>
    <tr><td><b>Tipologia</b></td><td>${esc(u.quartos)}</td></tr>
    ${u.area ? `<tr><td><b>Área privativa</b></td><td>${Number(u.area).toLocaleString("pt-BR")} m²</td></tr>` : ""}
    ${u.vaga ? `<tr><td><b>Vaga</b></td><td>${esc(u.vaga)}</td></tr>` : ""}
    ${u.pos ? `<tr><td><b>Posição</b></td><td>${esc(u.pos)}${u.mar ? " · face mar" : ""}</td></tr>` : ""}
    <tr><td><b>Valor da unidade</b></td><td><b>${brl(u.valor)}</b></td></tr>
  </tbody></table>
  ${f ? `<h3 style="color:#13233F;margin-top:16px">${esc(f.nome)}</h3><table><thead><tr><th>Etapa</th><th class="v">Parcelas</th><th class="v">Total</th></tr></thead><tbody>${linhas}<tr><td><b>Total</b></td><td></td><td class="v"><b>${brl(total)}</b></td></tr></tbody></table>` : ""}
  ${$("#pObs").value ? `<p><b>Observações:</b> ${esc($("#pObs").value)}</p>` : ""}
  <p style="font-size:12px;color:#555;margin-top:14px">${meses ? esc(meses) + "<br>" : ""}${esc(e.tabela)}${e.correcao ? " · " + esc(e.correcao) : ""}<br>
  <b>Valores e condições podem mudar sem aviso prévio.</b> Simulação sem valor de contrato; disponibilidade e condições sujeitas à confirmação da construtora.</p>
  <div style="margin-top:18px;padding-top:10px;border-top:1px solid #ddd;font-size:14px"><b>${esc(p.nome)}</b>${p.creci ? " · CRECI " + esc(p.creci) : ""}${p.wpp ? " · WhatsApp " + esc(p.wpp) : ""}</div>`;
}
function previa() { $("#pPrev").innerHTML = `<div style="border:1px dashed #CFC7B5;border-radius:10px;padding:14px">${htmlProposta(false)}</div>`; }
function gerarPdf() {
  salvarPerfil();
  const e = emp($("#pEmp").value), u = unid();
  const w = window.open("", "_blank");
  if (!w) { alert("Libere pop-ups para gerar o PDF."); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ${esc(e?.nome)} ${esc(u?.un)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>body{font-family:Inter,Arial,sans-serif;color:#1E2530;max-width:760px;margin:30px auto;padding:0 20px;font-size:14px}h1,h2,h3{font-family:Marcellus,Georgia,serif;font-weight:400}
  table{width:100%;border-collapse:collapse}td,th{padding:7px 6px;border-bottom:1px solid #e5e0d4;text-align:left}th{background:#FAF7F0}.v{text-align:right;white-space:nowrap}@page{margin:16mm}</style>
  </head><body>${htmlProposta(true)}<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}

/* ---------------- materiais ---------------- */
let matCarregado = false;
async function carregarMateriais() {
  if (matCarregado) return;
  try {
    const r = await wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "CorretoresMateriais", query: { sort: [{ fieldName: "empreendimento", order: "ASC" }, { fieldName: "ordem", order: "ASC" }], paging: { limit: 200 } } } });
    const L = (r.dataItems || []).map((i) => i.data);
    matCarregado = true;
    if (!L.length) { $("#mList").innerHTML = "Nenhum material cadastrado ainda."; return; }
    const g = {}; L.forEach((m) => (g[m.empreendimento || "Geral"] ||= []).push(m));
    $("#mList").innerHTML = Object.keys(g).sort().map((k) => `<h3 style="margin-top:14px">${esc(k)}</h3>` + g[k].map((m) =>
      `<div class="mat"><div><b>${esc(m.title)}</b>${m.categoria ? ` <span class="tag">${esc(m.categoria)}</span>` : ""}<br><span class="note">${esc(m.descricao || "")}</span></div><a class="btn s" href="${esc(m.link)}" target="_blank" rel="noopener">Abrir</a></div>`).join("")).join("");
  } catch (e) {
    $("#mList").innerHTML = '<div class="msg e">Não foi possível carregar os materiais. Saia e entre de novo.</div>';
  }
}

/* ---------------- apresentação ---------------- */
let AP = null, ITENS = [], SL = [], cur = 0;
async function iniciarApres() {
  try { AP = await (await fetch("/data/apresentacao.json", { cache: "no-store" })).json(); } catch { $("#ares").innerHTML = '<div class="msg e">Não foi possível carregar.</div>'; return; }
  const extra = Object.fromEntries(AP.emps.map((e) => [e.id, e]));
  ITENS = DADOS.emps.map((e) => ({ k: "e", id: e.id, nome: e.nome, sub: `${e.incorp} · ${e.bairro}, ${e.cidade}`, capa: extra[e.id]?.fotos?.[0] || "",
      preco: e._units.length ? "a partir de " + brl(e._min) : "valores sob consulta", e, x: extra[e.id] || {} }))
    .concat(AP.venda.map((v) => ({ k: "v", id: v.id, nome: v.nome, sub: [v.tipo, v.local].filter(Boolean).join(" · "), capa: v.fotos[0] || "",
      preco: v.valor >= 10000 ? brl(v.valor) : "valor a consultar", v })));
  $("#aq").addEventListener("input", listarApres);
  $("#aq").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { const f = $("#ares .acard"); if (f) f.click(); } });
  listarApres();
  $("#shX").addEventListener("click", fechar);
  $("#shP").addEventListener("click", () => ir(cur - 1));
  $("#shNx").addEventListener("click", () => ir(cur + 1));
  $("#shFs").addEventListener("click", () => { const el = $("#show"); if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); });
  document.addEventListener("keydown", (ev) => {
    if ($("#show").classList.contains("hid")) return;
    if (ev.key === "ArrowRight" || ev.key === " ") { ev.preventDefault(); ir(cur + 1); }
    if (ev.key === "ArrowLeft") ir(cur - 1);
    if (ev.key === "Escape" && !document.fullscreenElement) fechar();
  });
  let x0 = null;
  $("#stage").addEventListener("touchstart", (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  $("#stage").addEventListener("touchend", (ev) => { if (x0 == null) return; const dx = ev.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(cur + (dx < 0 ? 1 : -1)); x0 = null; });
}
function cardHtml(i) {
  return `<button class="acard" data-ap="${i.id}"><div class="im" style="background-image:url('${esc(i.capa)}')"></div><div class="tx"><b>${esc(i.nome)}</b><small>${esc(i.sub)}<br>${esc(i.preco)}</small></div></button>`;
}
function listarApres() {
  const q = norm($("#aq").value).split(/\s+/).filter(Boolean);
  let L = ITENS.filter((i) => { const h = norm([i.nome, i.sub, i.v?.descricao?.slice(0, 200)].join(" ")); return q.every((w) => h.includes(w)); });
  if (!q.length) L = L.filter((i) => i.k === "e");
  $("#ares").innerHTML = L.slice(0, 60).map(cardHtml).join("") || '<p class="note">Nada encontrado com esse nome.</p>';
  let rec = []; try { rec = JSON.parse(localStorage.getItem("rm_apres_rec") || "[]"); } catch {}
  const R = rec.map((id) => ITENS.find((i) => i.id === id)).filter(Boolean);
  $("#arec").innerHTML = !q.length && R.length ? `<p class="note" style="margin:12px 0 0">Abertos recentemente: ${R.map((i) => `<a href="#" data-ap="${i.id}">${esc(i.nome)}</a>`).join(" · ")}</p>` : "";
  $$("[data-ap]").forEach((b) => b.addEventListener("click", (ev) => { ev.preventDefault(); abrirApres(b.dataset.ap); }));
}
function abrirApres(id) {
  const i = ITENS.find((x) => x.id === id); if (!i) return;
  try { let r = JSON.parse(localStorage.getItem("rm_apres_rec") || "[]"); r = [id, ...r.filter((x) => x !== id)].slice(0, 6); localStorage.setItem("rm_apres_rec", JSON.stringify(r)); } catch {}
  SL = i.k === "e" ? slidesEmp(i) : slidesVenda(i);
  $$("#stage .sl").forEach((s) => s.remove());
  $("#stage").insertAdjacentHTML("beforeend", SL.join(""));
  $("#shT").textContent = i.nome;
  $("#shSec").innerHTML = $$("#stage .sl").map((s, k) => s.dataset.sec ? `<button class="btn o s" data-go="${k}">${esc(s.dataset.sec)}</button>` : "").join(" ");
  $$("#shSec [data-go]").forEach((b) => b.addEventListener("click", () => ir(+b.dataset.go)));
  $("#show").classList.remove("hid"); document.body.style.overflow = "hidden";
  ir(0);
}
function fechar() { $("#show").classList.add("hid"); document.body.style.overflow = ""; if (document.fullscreenElement) document.exitFullscreen?.(); }
function ir(n) {
  const S = $$("#stage .sl"); if (!S.length) return;
  cur = Math.max(0, Math.min(S.length - 1, n));
  S.forEach((s, k) => s.classList.toggle("on", k === cur));
  $("#shN").textContent = `${cur + 1} / ${S.length}`;
  $("#shP").style.visibility = cur ? "" : "hidden"; $("#shNx").style.visibility = cur < S.length - 1 ? "" : "hidden";
}
const bg = (u) => `style="background-image:url('${esc(u)}')"`;
const lista = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
function slideContato(aviso) {
  const p = lerPerfil();
  return `<section class="sl" data-sec="Contato"><div class="k">Fale comigo</div><h1>${esc(p.nome || "")}</h1>
    <p class="big">${p.wpp ? "WhatsApp " + esc(p.wpp) : ""}</p>${p.creci ? `<p>CRECI ${esc(p.creci)}</p>` : ""}
    <p class="aviso">${esc(aviso || "")} Valores e condições podem mudar sem aviso prévio. Imagens ilustrativas.</p></section>`;
}
function slidesEmp(i) {
  const e = i.e, x = i.x, S = [], fotos = x.fotos || [];
  let meses = "";
  if (e.entrega && /^\d{4}-\d{2}/.test(e.entrega)) {
    const d = new Date(), [ay, am] = e.entrega.split("-").map(Number);
    const n = (ay - d.getFullYear()) * 12 + (am - (d.getMonth() + 1));
    meses = n > 0 ? `Entrega ${mesAno(e.entrega)} · faltam ${n} meses` : `Entrega ${mesAno(e.entrega)}`;
  } else if (e.pronto) meses = "Pronto para morar";
  S.push(`<section class="sl capa" data-sec="Início" ${bg(fotos[0] || "")}><div class="cx"><div class="k">${esc(e.incorp)} · ${esc(e.status)}</div><h1>${esc(e.nome)}</h1>
    <p>${esc(e.endereco || e.bairro + ", " + e.cidade)}</p><p class="big">${esc(i.preco)}${meses ? ` <span style="font-size:.55em;color:#fff">· ${esc(meses)}</span>` : ""}</p></div></section>`);
  if (x.resumo || (x.ficha || []).length)
    S.push(`<section class="sl" data-sec="Ficha"><div class="k">O empreendimento</div><h2>${esc(e.nome)}</h2>${x.resumo ? `<p>${esc(x.resumo)}</p>` : ""}
      ${(x.ficha || []).length ? `<table>${x.ficha.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}</section>`);
  fotos.slice(1).forEach((f, k) => S.push(`<section class="sl foto" ${k ? "" : 'data-sec="Fotos"'} ${bg(f)}></section>`));
  if ((x.lazer || []).length) S.push(`<section class="sl" data-sec="Lazer"><div class="k">Lazer</div><h2>Lazer completo</h2>${lista(x.lazer)}</section>`);
  if ((x.dif || []).length) S.push(`<section class="sl"><div class="k">Diferenciais</div><h2>Diferenciais</h2>${lista(x.dif)}</section>`);
  if (e._units.length) {
    const g = {}; e._units.forEach((u) => { (g[u.quartos] ||= []).push(u); });
    const linhas = Object.keys(g).sort().map((k) => { const v = g[k].map((u) => u.valor), a = g[k].map((u) => u.area).filter(Boolean);
      return `<tr><td>${esc(k)}</td><td>${a.length ? Math.min(...a).toLocaleString("pt-BR") + (Math.max(...a) > Math.min(...a) ? " a " + Math.max(...a).toLocaleString("pt-BR") : "") + " m²" : ""}</td><td class="v">${g[k].length} disp.</td><td class="v">a partir de ${brl(Math.min(...v))}</td></tr>`; }).join("");
    S.push(`<section class="sl" data-sec="Valores"><div class="k">Unidades e valores</div><h2>Opções disponíveis</h2><table>${linhas}</table><p class="aviso">${esc(e.tabela)} · Valores podem mudar sem aviso prévio.</p></section>`);
    const u = e._units.slice().sort((a, b) => a.valor - b.valor)[0];
    (u.fluxos || []).forEach((f, k) => {
      S.push(`<section class="sl" ${k ? "" : 'data-sec="Pagamento"'}><div class="k">Exemplo de pagamento · unidade ${esc(u.un)} (${brl(u.valor)})</div><h2>${esc(f.nome)}</h2>
        <table>${f.linhas.map(([r, q, v]) => `<tr><td>${esc(r)}</td><td class="v">${q > 1 ? q + "x de " + brl(v) : brl(v)}</td></tr>`).join("")}</table>
        <p class="aviso">Simulação na menor unidade disponível. Valores podem mudar sem aviso prévio.</p></section>`);
    });
  } else if ((x.condicoes || []).length) S.push(`<section class="sl" data-sec="Pagamento"><div class="k">Condições</div><h2>Condições de pagamento</h2>${lista(x.condicoes)}</section>`);
  S.push(slideContato(""));
  return S;
}
function slidesVenda(i) {
  const v = i.v, S = [];
  S.push(`<section class="sl capa" data-sec="Início" ${bg(v.fotos[0] || "")}><div class="cx"><div class="k">${esc(v.tipo)}</div><h1>${esc(v.nome)}</h1>
    <p>${esc(v.local)}</p><p class="big">${esc(i.preco)}</p></div></section>`);
  if (v.info.length) S.push(`<section class="sl" data-sec="Ficha"><div class="k">O imóvel</div><h2>${esc(v.nome)}</h2><table>${v.info.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>
    ${v.comodidades.length ? `<p style="margin-top:14px">${v.comodidades.map(esc).join(" · ")}</p>` : ""}</section>`);
  v.fotos.slice(1).forEach((f, k) => S.push(`<section class="sl foto" ${k ? "" : 'data-sec="Fotos"'} ${bg(f)}></section>`));
  if (v.descricao) S.push(`<section class="sl" data-sec="Descrição"><div class="k">Descrição</div><h2>${esc(v.nome)}</h2><p style="white-space:pre-line;font-size:clamp(15px,1.5vw,18px)">${esc(v.descricao)}</p></section>`);
  S.push(slideContato(""));
  return S;
}
