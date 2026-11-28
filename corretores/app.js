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
  if (st === "OWNER_APPROVAL_REQUIRED") { msg("Pedido recebido! Seu acesso será liberado assim que o Renan aprovar. Você recebe a confirmação por e-mail.", "ok"); return; }
  const code = r && (r.errorCode || r.error || "");
  if (/exists/i.test(code)) msg("Este e-mail já tem cadastro. Use a aba Entrar.", "e");
  else if (/password|invalid|notFound|wrong/i.test(code)) msg("E-mail ou senha incorretos.", "e");
  else msg("Não foi possível entrar agora. Se você acabou de pedir acesso, aguarde a aprovação do Renan.", "e");
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
