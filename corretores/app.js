import { subscribeMember, getMemberState, login, verifyEmail, logout } from "/js/wix/member-store.js";
import { wixRequest, WixApiError } from "/js/wix/client.js";
import { authOutcome, toLoginResult, registerErrorCode } from "/js/wix/auth-core.js";
import * as AP from "/js/apres.js?v=7146897e";

const DONO = "renanmartinscor@gmail.com";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mesAno = (e) => (e && /^\d{4}-\d{2}/.test(e) ? e.slice(5, 7) + "/" + e.slice(0, 4) : e || "");

let DADOS = null, iniciado = false, PED = null, perfilCarregado = false, PERFIL_ID = null;

/* ---------------- login ---------------- */
function msg(html, tipo = "i") { $("#authMsg").innerHTML = html ? `<div class="msg ${tipo}">${html}</div>` : ""; }
function estado(r) { return (r && (r.state || r.status || r.result)) || ""; }
function tratar(r, acao) {
  const st = estado(r);
  if (st === "SUCCESS") { msg(""); return; }
  if (st === "EMAIL_VERIFICATION_REQUIRED") { mostrarForm("fCod"); msg("Enviamos um código para o seu e-mail. Digite para confirmar.", "i"); return; }
  if (st === "OWNER_APPROVAL_REQUIRED") {
    msg(acao === "up" ? "Cadastro enviado! O Renan recebe o seu pedido por e-mail. Assim que ele aprovar, você entra com o seu e-mail e a senha que criou."
      : "Seu cadastro ainda está aguardando a aprovação do Renan. Assim que ele aprovar, é só entrar com este e-mail e senha.", "ok");
    return;
  }
  const code = String((r && (r.errorCode || "")) || "");
  const txt = {
    emailAlreadyExists: "Este e-mail já tem cadastro. Use a opção Entrar. Se o cadastro ainda não foi aprovado, aguarde a aprovação do Renan.",
    invalidCredentials: "E-mail ou senha incorretos.", invalidPassword: "Senha incorreta.", invalidEmail: acao === "up" ? "Confira o e-mail digitado." : "E-mail ou senha incorretos.",
    resetPassword: "Você precisa criar uma nova senha. Fale com o Renan.",
    missingCaptchaToken: "O cadastro está bloqueado por uma verificação anti-robô. Avise o Renan.", invalidCaptchaToken: "O cadastro está bloqueado por uma verificação anti-robô. Avise o Renan.",
    captchaRequired: "O cadastro está bloqueado por uma verificação anti-robô. Avise o Renan.",
  }[code] || "Não foi possível concluir agora. Tente de novo em instantes ou avise o Renan.";
  msg(esc(txt) + (code ? ` <small style="opacity:.6">(${esc(code)})</small>` : ""), "e");
}
function mostrarForm(id) { ["fIn", "fUp", "fCod"].forEach((f) => $("#" + f).classList.toggle("hid", f !== id)); }
$$("[data-a]").forEach((b) => b.addEventListener("click", () => {
  $$("[data-a]").forEach((x) => x.classList.toggle("on", x === b));
  mostrarForm(b.dataset.a === "in" ? "fIn" : "fUp"); msg("");
  if (b.dataset.a === "up") montarCaptcha();
}));
$("#fIn").addEventListener("submit", async (ev) => {
  ev.preventDefault(); msg("Entrando…");
  try { tratar(await login($("#inEmail").value.trim(), $("#inSenha").value), "in"); } catch (e) { tratar({ errorCode: e?.code || "erro" }, "in"); }
});
/* Cadastro com reCAPTCHA (o Wix exige na inscrição) */
const CAP_KEY = "6Ld0J8IcAAAAANyrnxzrRlX1xrrdXsOmsepUYosy"; // chave visível do Wix
let capId = null, capTok = "", estadoCad = null;
function montarCaptcha() {
  if (capId !== null) return;
  const g = window.grecaptcha && window.grecaptcha.enterprise;
  if (!g || !g.render) { setTimeout(montarCaptcha, 300); return; }
  try { capId = g.render("capBox", { sitekey: CAP_KEY, callback: (t) => { capTok = t; }, "expired-callback": () => { capTok = ""; } }); } catch (e) { capId = null; }
}
function resetCaptcha() { capTok = ""; try { window.grecaptcha.enterprise.reset(capId); } catch (e) {} }
async function resultadoAuth(raw) {
  const o = authOutcome(raw);
  if (o.stateToken) estadoCad = o.stateToken;
  if (o.state === "SUCCESS") { location.reload(); return { state: "SUCCESS" }; }
  return toLoginResult(o);
}
$("#fUp").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!capTok) { msg("Marque a caixa \"Não sou um robô\" antes de enviar.", "e"); return; }
  const cel = $("#upCel").value.trim(), creci = $("#upCreci").value.trim();
  if (cel.replace(/\D/g, "").length < 10) { msg("Confira o celular com DDD.", "e"); return; }
  if (creci.length < 3) { msg("Informe o seu CRECI.", "e"); return; }
  msg("Enviando…");
  const body = { loginId: { email: $("#upEmail").value.trim() }, password: $("#upSenha").value,
    profile: { firstName: $("#upNome").value.trim(), lastName: $("#upSob").value.trim() }, captcha_tokens: [{ Recaptcha: capTok }] };
  const nomeCad = ($("#upNome").value.trim() + " " + $("#upSob").value.trim()).trim();
  salvarPerfil({ nome: nomeCad, creci, wpp: cel });
  wixRequest("/wix-data/v2/items", { body: { dataCollectionId: "CadastroCorretor", dataItem: { data: { title: nomeCad, email: $("#upEmail").value.trim().toLowerCase(), celular: cel, creci } } } }).catch(() => {});
  try { tratar(await resultadoAuth(await wixRequest("/_api/iam/authentication/v2/register", { body })), "up"); }
  catch (e) { tratar({ errorCode: (e instanceof WixApiError && registerErrorCode(e.code, e.details)) || e?.code || "erro" }, "up"); }
  resetCaptcha();
});
$("#fCod").addEventListener("submit", async (ev) => {
  ev.preventDefault(); msg("Confirmando…");
  if (!estadoCad) { try { tratar(await verifyEmail($("#cod").value.trim()), "up"); } catch (e) { tratar({ errorCode: e?.code || "erro" }, "up"); } return; }
  try { tratar(await resultadoAuth(await wixRequest("/_api/iam/verification/v1/auth/verify", { body: { code: $("#cod").value.trim(), stateToken: estadoCad } })), "up"); }
  catch (e) { tratar({ errorCode: e?.code || "erro" }, "up"); }
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
  $("#mBtn").classList.toggle("hid", !on);
  $("#who").textContent = on ? nomeDo(st.member) : "";
  if (on) {
    $("#tabLeads").classList.toggle("hid", emailDo(st.member) !== DONO);
    if (emailDo(st.member) === DONO && PED === null) setTimeout(carregarPedidos, 800);
    if (!lerPerfil().nome) salvarPerfil({ ...lerPerfil(), nome: nomeDo(st.member) });
    if (!perfilCarregado) { perfilCarregado = true; carregarPerfil(st.member); }
    if (!iniciado) { iniciado = true; iniciar(); abrirAba("apres"); }
  }
}
subscribeMember(render);
render(getMemberState());

/* ---------------- abas ---------------- */
$$("#tabs button[data-t]").forEach((b) => b.addEventListener("click", () => { abrirAba(b.dataset.t); menu(false); }));
function menu(abrir) { $("#tabs").classList.toggle("hid", !abrir); $("#mBtn").setAttribute("aria-expanded", abrir ? "true" : "false"); }
$("#mBtn").addEventListener("click", (ev) => { ev.stopPropagation(); menu($("#tabs").classList.contains("hid")); });
document.addEventListener("click", (ev) => { if (!ev.target.closest("#tabs")) menu(false); });
function abrirAba(t) {
  $$("#tabs button[data-t]").forEach((x) => x.classList.toggle("on", x.dataset.t === t));
  const b = $(`#tabs button[data-t="${t}"]`); $("#secAt").textContent = b ? "· " + b.textContent : "";
  $$("[data-p]").forEach((p) => p.classList.toggle("hid", p.dataset.p !== t));
  if (t === "materiais") carregarMateriais();
  if (t === "leads") { carregarLeads(); carregarPedidos(); }
}

async function iniciar() {
  try { DADOS = await (await fetch("/data/corretores.json", { cache: "no-store" })).json(); }
  catch { $("#bres").innerHTML = '<div class="msg e">Não foi possível carregar os dados agora.</div>'; return; }
  DADOS.emps.forEach((e) => { e._units = DADOS.units.filter((u) => u.emp === e.id); e._min = e._units.length ? Math.min(...e._units.map((u) => u.valor).filter((v) => v > 0)) : (e.aPartir || 0); });
  const atual = DADOS.gerado ? new Date(DADOS.gerado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  $$(".atualizado").forEach((el) => (el.textContent = atual ? "Dados do site atualizados em " + atual + ". Tudo aqui vem do site e se atualiza sozinho." : ""));
  const opts = DADOS.emps.filter((e) => e._units.length).sort((a, b) => a.nome.localeCompare(b.nome))
    .map((e) => `<option value="${e.id}">${esc(e.nome)} (${e._units.length})</option>`).join("");
  $("#tEmp").innerHTML = opts; $("#pEmp").innerHTML = opts;
  $("#bq").addEventListener("input", busca); busca();
  $("#tEmp").addEventListener("change", () => { preencherQ(); tabela(); });
  $("#tQ").addEventListener("change", tabela);
  $("#tPrint").addEventListener("click", () => window.print());
  $("#tCsv").addEventListener("click", csv);
  preencherQ(); tabela();
  mostrarSeus();
  $("#pEmp").addEventListener("change", () => { unidades(); });
  $("#pUn").addEventListener("change", fluxos);
  $("#pFx").addEventListener("change", previa);
  ["pCli", "pObs"].forEach((id) => $("#" + id).addEventListener("input", previa));
  $("#pGerar").addEventListener("click", gerarPdf);
  $("#pApres").addEventListener("click", () => { const i = ITENS.find((x) => x.id === $("#pEmp").value); if (i) AP.abrir(i, $("#pUn").value, lerPerfil()); });
  $("#pShare").addEventListener("click", () => { const i = ITENS.find((x) => x.id === $("#pEmp").value); if (i) partilhar(i, $("#pUn").value); });
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
      <span class="tag">${esc(e.status)}</span>${e._units.length ? `<span class="tag">${e._units.length} disponíveis</span><span class="tag">a partir de ${brl(e._min)}</span>` : e._min ? `<span class="tag">a partir de ${brl(e._min)}</span><span class="tag">tabela sob consulta</span>` : '<span class="tag">valores sob consulta</span>'}<br><span class="note">${esc(e.tabela || "")}</span></div>
      <span class="sp"></span>
      ${e._units.length ? `<button class="btn s" data-ver="${e.id}">Tabela</button> <button class="btn o s" data-prop="${e.id}">Proposta</button>` : ""}
      <a class="btn o s" href="${e.url}" target="_blank">Página</a>
    </div>`).join("") : "";
  const V = q.length && ITENS.length ? ITENS.filter((i) => i.k === "v" && q.every((w) => norm(i.nome + " " + i.sub).includes(w))).slice(0, 30) : [];
  $("#bres").innerHTML += V.map((i) => `
    <div class="emp"><div><b>${esc(i.nome)}</b><br><span class="note">${esc(i.sub)}</span><br><span class="tag">À venda</span><span class="tag">${esc(i.preco)}</span></div>
      <span class="sp"></span><button class="btn s" data-apv="${i.id}">Apresentar</button> <a class="btn o s" href="${esc(i.v.url)}" target="_blank">Página</a></div>`).join("");
  if (!L.length && !V.length) $("#bres").innerHTML = '<p class="note">Nada encontrado com esse nome.</p>';
  $$("[data-apv]").forEach((b) => b.addEventListener("click", () => abrirApres(b.dataset.apv)));
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
  $("#tTab").innerHTML = `<thead><tr><th>Unidade</th><th>Tipologia</th><th class="v">Área (m²)</th><th>Vaga</th><th>Posição</th><th class="v">Valor</th><th class="noprint">Apresentação</th></tr></thead><tbody>` +
    L.map((u) => `<tr><td>${esc(u.un)}</td><td>${esc(u.quartos)}</td><td class="v">${u.area ? Number(u.area).toLocaleString("pt-BR") : "—"}</td><td>${esc(u.vaga)}</td><td>${esc(u.pos)}${(u.mar || /leste/i.test(u.pos || "")) ? ' <span class="tag">face mar</span>' : ""}</td><td class="v">${brl(u.valor)}</td>
      <td class="noprint" style="white-space:nowrap"><button class="btn s" data-tap="${u.id}">▶</button> <button class="btn o s" data-tsh="${u.id}">🔗 Compartilhar</button></td></tr>`).join("") + "</tbody>";
  const it = () => ITENS.find((x) => x.id === e.id);
  $$("[data-tap]").forEach((b) => b.addEventListener("click", () => it() && AP.abrir(it(), b.dataset.tap, lerPerfil())));
  $$("[data-tsh]").forEach((b) => b.addEventListener("click", () => it() && partilhar(it(), b.dataset.tsh, b)));
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
function salvarPerfil(p) { try { localStorage.setItem("rm_corretor_v1", JSON.stringify({ nome: p.nome || "", creci: p.creci || "", wpp: p.wpp || "" })); } catch {} mostrarSeus(); }
function mostrarSeus() {
  const p = lerPerfil(), el = $("#pSeus"); if (!el) return;
  el.innerHTML = `<b>Seus dados na proposta:</b> ${esc(p.nome || "—")}${p.creci ? " · CRECI " + esc(p.creci) : ""}${p.wpp ? " · " + esc(p.wpp) : ""} · <a href="#" id="pAlt">alterar</a>`;
  $("#pAlt").onclick = (ev) => { ev.preventDefault(); abrirAba("dados"); };
}
/* ---------------- meus dados (cada corretor atualiza o seu) ---------------- */
async function carregarPerfil(member) {
  const p = lerPerfil();
  $("#dNome").value = p.nome || nomeDo(member); $("#dCel").value = p.wpp || ""; $("#dCreci").value = p.creci || "";
  try {
    const r = await wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "PerfilCorretor", query: { paging: { limit: 5 } } } });
    const it = (r.dataItems || []).find((i) => !emailDo(member) || (i.data.email || "").toLowerCase() === emailDo(member)) || (r.dataItems || [])[0];
    if (it) {
      PERFIL_ID = it.id;
      const d = it.data;
      salvarPerfil({ nome: d.title || p.nome, creci: d.creci || "", wpp: d.celular || "" });
      $("#dNome").value = d.title || p.nome || ""; $("#dCel").value = d.celular || ""; $("#dCreci").value = d.creci || "";
    }
  } catch (e) {}
  const q = lerPerfil();
  if (!q.creci || !q.wpp) {
    const card = $('[data-p="apres"]');
    if (card && !$("#avDados")) card.insertAdjacentHTML("afterbegin", '<div class="aviso-dados" id="avDados">Complete seus dados (celular e CRECI) para aparecerem nas apresentações que você compartilhar. <a href="#" id="avIr">Preencher agora</a></div>');
    const ir = $("#avIr"); if (ir) ir.onclick = (ev) => { ev.preventDefault(); abrirAba("dados"); };
  }
}
async function gravarPerfil() {
  const p = { nome: $("#dNome").value.trim(), wpp: $("#dCel").value.trim(), creci: $("#dCreci").value.trim() };
  if (!p.nome || !p.wpp || !p.creci) { $("#dMsg").textContent = "Preencha nome, celular e CRECI."; return; }
  salvarPerfil(p);
  const data = { title: p.nome, celular: p.wpp, creci: p.creci, email: emailDo(getMemberState().member) };
  $("#dMsg").textContent = "Salvando…";
  try {
    if (PERFIL_ID) await wixRequest(`/wix-data/v2/items/${PERFIL_ID}`, { method: "PUT", body: { dataCollectionId: "PerfilCorretor", dataItem: { id: PERFIL_ID, data } } });
    else { const r = await wixRequest("/wix-data/v2/items", { body: { dataCollectionId: "PerfilCorretor", dataItem: { data } } }); PERFIL_ID = r.dataItem?.id || null; }
    $("#dMsg").textContent = "Dados salvos!";
    const av = $("#avDados"); if (av) av.remove();
  } catch (e) { $("#dMsg").textContent = "Salvo neste aparelho. Não consegui salvar na nuvem agora; tente de novo depois."; }
}
$("#dSalvar").addEventListener("click", gravarPerfil);
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
  const p = lerPerfil();
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
let ITENS = [], ESC = null;
async function iniciarApres() {
  try { ITENS = (await AP.carregar()).itens; } catch { $("#ares").innerHTML = '<div class="msg e">Não foi possível carregar.</div>'; return; }
  $("#aq").addEventListener("input", listarApres);
  $("#aq").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { const f = $("#ares [data-ap]") || $("#ares button[data-geral]"); if (f) f.click(); } });
  $("#escX").addEventListener("click", () => $("#esc").classList.add("hid"));
  $("#esc").addEventListener("click", (ev) => { if (ev.target.id === "esc") $("#esc").classList.add("hid"); });
  $("#escQ").addEventListener("input", listarUnidadesEsc);
  $("#escGeral").addEventListener("click", () => { $("#esc").classList.add("hid"); AP.abrir(ESC, null, lerPerfil()); });
  $("#escGeralSh").addEventListener("click", () => partilhar(ESC, null));
  listarApres(); busca();
}
function cardHtml(i) {
  const temU = i.e && i.e._units.length;
  return `<div class="acard"><div class="im" data-geral="${i.id}" style="background-image:url('${esc(i.capa)}')"></div><div class="tx"><b>${esc(i.nome)}</b><small>${esc(i.sub)}<br>${esc(i.preco)}${temU ? ` · ${i.e._units.length} unidades` : ""}</small>
    <div class="acts"><button class="btn s" data-geral="${i.id}">▶ ${temU ? "Geral" : "Apresentar"}</button>${temU ? `<button class="btn s uni" data-ap="${i.id}">🏠 Unidade específica</button>` : ""}<button class="btn o s" data-shg="${i.id}" title="Compartilhar">🔗</button></div></div></div>`;
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
  $$("[data-geral]").forEach((b) => b.addEventListener("click", () => { const i = ITENS.find((x) => x.id === b.dataset.geral); if (i) { lembrar(i.id); AP.abrir(i, null, lerPerfil()); } }));
  $$("[data-shg]").forEach((b) => b.addEventListener("click", () => { const i = ITENS.find((x) => x.id === b.dataset.shg); if (i) partilhar(i, null); }));
}
function lembrar(id) { try { let r = JSON.parse(localStorage.getItem("rm_apres_rec") || "[]"); r = [id, ...r.filter((x) => x !== id)].slice(0, 6); localStorage.setItem("rm_apres_rec", JSON.stringify(r)); } catch {} }
function abrirApres(id) {
  const i = ITENS.find((x) => x.id === id); if (!i) return;
  lembrar(id);
  if (i.k === "e" && i.e._units.length) { escolher(i); return; }
  AP.abrir(i, null, lerPerfil());
}
/* escolha: apresentação geral ou de uma unidade */
function escolher(i) {
  ESC = i;
  $("#escT").textContent = i.nome; $("#escS").textContent = `${i.sub} · ${i.preco}`;
  $("#escQ").value = ""; listarUnidadesEsc();
  $("#esc").classList.remove("hid"); setTimeout(() => $("#escQ").focus(), 50);
}
function listarUnidadesEsc() {
  const q = norm($("#escQ").value).split(/\s+/).filter(Boolean);
  const U = ESC.e._units.filter((u) => q.every((w) => norm([u.un, u.quartos, u.pos, u.vaga].join(" ")).includes(w)))
    .sort((a, b) => String(a.un).localeCompare(String(b.un), "pt-BR", { numeric: true }));
  $("#escL").innerHTML = U.map((u) => `<div class="urow"><div><b>${esc(u.un)}</b> <span class="note">${esc(u.quartos)}${u.area ? " · " + Number(u.area).toLocaleString("pt-BR") + " m²" : ""}${u.pos ? " · " + esc(u.pos) : ""}${(u.mar || /leste/i.test(u.pos || "")) ? ' · <span class="tag">face mar</span>' : ""}</span></div>
    <span class="sp"></span><b class="uv">${brl(u.valor)}</b><button class="btn s" data-uap="${u.id}">▶ Apresentar</button><button class="btn o s" data-ush="${u.id}" title="Compartilhar link">🔗 Compartilhar unidade</button></div>`).join("") || '<p class="note">Nenhuma unidade com esse filtro.</p>';
  $$("[data-uap]").forEach((b) => b.addEventListener("click", () => { $("#esc").classList.add("hid"); AP.abrir(ESC, b.dataset.uap, lerPerfil()); }));
  $$("[data-ush]").forEach((b) => b.addEventListener("click", () => partilhar(ESC, b.dataset.ush)));
}
async function partilhar(i, unitId, btn) {
  const p = lerPerfil();
  const u = unitId ? i.e._units.find((z) => z.id === unitId) : null;
  const r = await AP.compartilhar(AP.linkCompartilhar(i, unitId, p), u ? `${i.nome} · unidade ${u.un}` : i.nome);
  if (r === "copiado") toast("Link copiado! É só colar no WhatsApp do cliente.");
}
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); }

/* ---------------- leads (só o dono) ---------------- */
let LEADS = null;
async function carregarLeads(forcar) {
  if (LEADS && !forcar) return mostrarLeads();
  $("#lInfo").textContent = "Carregando…";
  try {
    const L = []; let off = 0;
    for (;;) {
      const r = await wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "LeadsSite", query: { sort: [{ fieldName: "_createdDate", order: "DESC" }], paging: { limit: 100, offset: off } } } });
      const it = (r.dataItems || []).map((i) => i.data); L.push(...it);
      if (it.length < 100 || L.length >= 2000) break; off += 100;
    }
    LEADS = L; mostrarLeads();
  } catch (e) {
    $("#lInfo").innerHTML = 'Não consegui abrir a lista aqui. Use o botão "Abrir leads no painel do Wix" logo abaixo.';
    $("#lTab").innerHTML = "";
  }
}
function linhasLeads() {
  const q = norm($("#lq").value).split(/\s+/).filter(Boolean);
  return (LEADS || []).filter((l) => { const h = norm([l.title, l.email, l.cidade, l.mensagem, l.pagina, l.tipo].join(" ")); return q.every((w) => h.includes(w)); });
}
const dataHora = (d) => { try { return new Date(d.$date || d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return ""; } };
function mostrarLeads() {
  const L = linhasLeads();
  const pessoas = new Set((LEADS || []).map((l) => (l.email || "").toLowerCase()).filter(Boolean)).size;
  $("#lInfo").textContent = `${(LEADS || []).length} contatos · ${pessoas} pessoas diferentes${L.length !== (LEADS || []).length ? ` · ${L.length} no filtro` : ""}`;
  $("#kLeads").textContent = (LEADS || []).length; $("#kPess").textContent = pessoas;
  $("#lTab").innerHTML = `<thead><tr><th>Quando</th><th>Nome</th><th>E-mail</th><th>Cidade</th><th>Tipo</th><th>Mensagem / imóvel</th></tr></thead><tbody>` +
    L.map((l) => `<tr><td style="white-space:nowrap">${esc(dataHora(l._createdDate))}</td><td>${esc(l.title)}</td><td>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ""}</td><td>${esc(l.cidade)}</td><td>${esc(l.tipo || "Primeiro contato")}</td><td style="max-width:360px">${esc((l.mensagem || "").slice(0, 220))}<br><span class="note">${esc(l.pagina || "")}</span></td></tr>`).join("") + "</tbody>";
}
$("#lq").addEventListener("input", () => LEADS && mostrarLeads());
$("#lAtual").addEventListener("click", () => carregarLeads(true));
$("#lCsv").addEventListener("click", () => {
  const c = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const out = [["Quando", "Nome", "E-mail", "Cidade", "Tipo", "Mensagem", "Página"].map(c).join(";")]
    .concat(linhasLeads().map((l) => [dataHora(l._createdDate), l.title, l.email, l.cidade, l.tipo || "Primeiro contato", l.mensagem, l.pagina].map(c).join(";")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + out.join("\n")], { type: "text/csv;charset=utf-8" }));
  a.download = "leads-site.csv"; a.click();
});

/* ---------------- pedidos de acesso (só o dono) ---------------- */
async function carregarPedidos() {
  $("#pList").innerHTML = '<div class="vazio">Carregando…</div>';
  try {
    const [r, d] = await Promise.all([
      wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "PedidosAcesso", query: { paging: { limit: 100 } } } }),
      wixRequest("/wix-data/v2/items/query", { body: { dataCollectionId: "DecisoesAcesso", query: { paging: { limit: 100 }, sort: [{ fieldName: "_createdDate", order: "DESC" }] } } }),
    ]);
    const enviados = new Set((d.dataItems || []).filter((x) => x.data.processado !== "sim").map((x) => x.data.memberId));
    PED = (r.dataItems || []).map((x) => ({ ...x.data, enviado: enviados.has(x.data.memberId) }));
    mostrarPedidos();
  } catch (e) {
    $("#kPend").textContent = "?";
    $("#pList").innerHTML = `<div class="vazio">Não consegui abrir os pedidos agora. Tente "Atualizar" daqui a pouco.<br><small>(${esc(e?.status || "")})</small></div>`;
  }
}
function mostrarPedidos() {
  const n = PED.filter((m) => !m.enviado).length;
  $("#kPend").textContent = n;
  $("#tabLeads").textContent = n ? `Área do dono (${n} pedido${n > 1 ? "s" : ""})` : "Área do dono";
  if (!PED.length) { $("#pList").innerHTML = '<div class="vazio">Nenhum pedido esperando. Quando um corretor se cadastrar, ele aparece aqui em até 1 hora (e o Wix também te avisa por e-mail).</div>'; return; }
  $("#pList").innerHTML = PED.map((m) => {
    const quando = m.pedidoEm ? new Date(m.pedidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
    return `<div class="ped"><div class="av">${esc((m.title || "?").trim().charAt(0).toUpperCase())}</div>
      <div><b>${esc(m.title)}</b><br><span class="note">${esc(m.email || "")}${m.celular ? " · " + esc(m.celular) : ""}${m.creci ? " · CRECI " + esc(m.creci) : ""}${quando ? " · pediu em " + esc(quando) : ""}</span></div><span class="sp"></span>
      ${m.enviado ? '<span class="tag">✓ aprovado · libera em até 1 hora</span>' : `<button class="btn ok" data-apr="${esc(m.memberId)}">✓ Aprovar</button>`}</div>`;
  }).join("");
  $$("[data-apr]").forEach((b) => b.addEventListener("click", () => aprovar(b.dataset.apr, b)));
}
async function aprovar(id, btn) {
  btn.disabled = true; btn.textContent = "Aprovando…";
  try {
    await wixRequest("/wix-data/v2/items", { body: { dataCollectionId: "DecisoesAcesso", dataItem: { data: { title: "aprovar", memberId: id, processado: "" } } } });
    PED = PED.map((m) => (m.memberId === id ? { ...m, enviado: true } : m)); mostrarPedidos();
  } catch (e) {
    btn.disabled = false; btn.textContent = "✓ Aprovar";
    alert("Não consegui registrar a aprovação. Tente de novo.");
  }
}
$("#pAtual").addEventListener("click", carregarPedidos);
