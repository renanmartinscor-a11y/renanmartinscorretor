/* Apresentação de imóveis (Renan Martins Corretor)
   Usada na Área do Corretor e na página pública /apresentacao/ (link compartilhado).
   Só usa dados que já estão no site: /data/corretores.json e /data/apresentacao.json. */

const brl = (v) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mesAno = (e) => (e && /^\d{4}-\d{2}/.test(e) ? e.slice(5, 7) + "/" + e.slice(0, 4) : e || "");
const m2 = (a) => Number(a).toLocaleString("pt-BR");
export const util = { brl, esc, mesAno };

/* ---------------- dados ---------------- */
let CACHE = null;
export async function carregar() {
  if (CACHE) return CACHE;
  const [d, ap] = await Promise.all([
    fetch("/data/corretores.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("/data/apresentacao.json", { cache: "no-store" }).then((r) => r.json()),
  ]);
  const extra = Object.fromEntries(ap.emps.map((e) => [e.id, e]));
  d.emps.forEach((e) => {
    e._units = d.units.filter((u) => u.emp === e.id);
    e._min = e._units.length ? Math.min(...e._units.map((u) => u.valor).filter((v) => v > 0)) : e.aPartir || 0;
  });
  const itens = d.emps.map((e) => ({ k: "e", id: e.id, nome: e.nome, sub: `${e.incorp} · ${e.bairro}, ${e.cidade}`, capa: extra[e.id]?.fotos?.[0] || "",
      preco: e._min ? "a partir de " + brl(e._min) : "valores sob consulta", e, x: extra[e.id] || {} }))
    .concat(ap.venda.map((v) => ({ k: "v", id: v.id, nome: v.nome, sub: [v.tipo, v.local].filter(Boolean).join(" · "), capa: v.fotos[0] || "",
      preco: v.valor >= 10000 ? brl(v.valor) : "valor a consultar", v })));
  CACHE = { dados: d, itens };
  return CACHE;
}

/* ---------------- slides ---------------- */
const bg = (u) => `style="background-image:url('${esc(u)}')"`;
const lista = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
const faceMar = (u) => !!(u.mar || /leste/i.test(u.pos || ""));
function entregaTxt(e) {
  if (e.entrega && /^\d{4}-\d{2}/.test(e.entrega)) {
    const d = new Date(), [ay, am] = e.entrega.split("-").map(Number);
    const n = (ay - d.getFullYear()) * 12 + (am - (d.getMonth() + 1));
    return n > 0 ? `Entrega ${mesAno(e.entrega)} · faltam ${n} meses` : `Entrega ${mesAno(e.entrega)}`;
  }
  return e.pronto ? "Pronto para morar" : "";
}
function slideContato(perfil) {
  const p = perfil || {};
  const num = String(p.wpp || "").replace(/\D/g, "");
  const wa = num ? "https://wa.me/" + (num.length <= 11 ? "55" + num : num) : "";
  return `<section class="sl" data-sec="Contato"><div class="k">Fale comigo</div><h1>${esc(p.nome || "")}</h1>
    ${p.wpp ? `<p class="big">WhatsApp ${esc(p.wpp)}</p>` : ""}${p.creci ? `<p>CRECI ${esc(p.creci)}</p>` : ""}
    ${wa ? `<p><a class="rmA-wa" href="${wa}" target="_blank" rel="noopener">Chamar no WhatsApp</a></p>` : ""}
    <p class="aviso">Valores e condições podem mudar sem aviso prévio. Imagens ilustrativas. Simulações sem valor de contrato.</p></section>`;
}
function slidesFluxos(u, titulo) {
  return (u.fluxos || []).map((f, k) => {
    const tot = f.linhas.reduce((s, l) => s + l[1] * l[2], 0);
    return `<section class="sl" ${k ? "" : 'data-sec="Pagamento"'}><div class="k">${esc(titulo)}</div><h2>${esc(f.nome)}</h2>
      <table>${f.linhas.map(([r, q, v, d]) => `<tr><td>${esc(r)}${d && !/^#/.test(d) ? " · " + esc(d) : ""}</td><td class="v">${q > 1 ? q + "x de " + brl(v) : brl(v)}</td><td class="v">${brl(q * v)}</td></tr>`).join("")}
      <tr><td><b>Total</b></td><td></td><td class="v"><b>${brl(tot)}</b></td></tr></table>
      <p class="aviso">Valores e condições podem mudar sem aviso prévio.</p></section>`;
  });
}
function slidesEmpBase(i, S) {
  const e = i.e, x = i.x, fotos = x.fotos || [];
  if (x.resumo || (x.ficha || []).length)
    S.push(`<section class="sl" data-sec="Empreendimento"><div class="k">O empreendimento</div><h2>${esc(e.nome)}</h2>${x.resumo ? `<p>${esc(x.resumo)}</p>` : ""}
      ${(x.ficha || []).length ? `<table>${x.ficha.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}</section>`);
  fotos.slice(1).forEach((f, k) => S.push(`<section class="sl foto" ${k ? "" : 'data-sec="Fotos"'} ${bg(f)}></section>`));
  if ((x.lazer || []).length) S.push(`<section class="sl" data-sec="Lazer"><div class="k">Lazer</div><h2>Lazer completo</h2>${lista(x.lazer)}</section>`);
  if ((x.dif || []).length) S.push(`<section class="sl"><div class="k">Diferenciais</div><h2>Diferenciais</h2>${lista(x.dif)}</section>`);
}
export function slides(i, unitId, perfil) {
  const S = [];
  if (i.k === "v") {
    const v = i.v;
    S.push(`<section class="sl capa" data-sec="Início" ${bg(v.fotos[0] || "")}><div class="cx"><div class="k">${esc(v.tipo)}</div><h1>${esc(v.nome)}</h1>
      <p>${esc(v.local)}</p><p class="big">${esc(i.preco)}</p></div></section>`);
    if (v.info.length) S.push(`<section class="sl" data-sec="Ficha"><div class="k">O imóvel</div><h2>${esc(v.nome)}</h2><table>${v.info.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>
      ${v.comodidades.length ? `<p style="margin-top:14px">${v.comodidades.map(esc).join(" · ")}</p>` : ""}</section>`);
    v.fotos.slice(1).forEach((f, k) => S.push(`<section class="sl foto" ${k ? "" : 'data-sec="Fotos"'} ${bg(f)}></section>`));
    if (v.descricao) S.push(`<section class="sl" data-sec="Descrição"><div class="k">Descrição</div><h2>${esc(v.nome)}</h2><p style="white-space:pre-line;font-size:clamp(15px,1.5vw,18px)">${esc(v.descricao)}</p></section>`);
    S.push(slideContato(perfil));
    return S;
  }
  const e = i.e, x = i.x, fotos = x.fotos || [], ent = entregaTxt(e);
  const u = unitId ? e._units.find((z) => z.id === unitId) : null;
  if (u) {
    /* apresentação da unidade */
    S.push(`<section class="sl capa" data-sec="Início" ${bg(fotos[0] || "")}><div class="cx"><div class="k">${esc(e.nome)} · ${esc(e.incorp)}</div>
      <h1>Unidade ${esc(u.un)}</h1><p>${esc(u.quartos)}${u.area ? " · " + m2(u.area) + " m²" : ""}${faceMar(u) ? " · face mar" : ""}</p>
      <p class="big">${brl(u.valor)}${ent ? ` <span style="font-size:.5em;color:#fff">· ${esc(ent)}</span>` : ""}</p></div></section>`);
    S.push(`<section class="sl" data-sec="Unidade"><div class="k">Ficha da unidade</div><h2>Unidade ${esc(u.un)}</h2><table>
      <tr><td><b>Empreendimento</b></td><td>${esc(e.nome)} · ${esc(e.incorp)}</td></tr>
      <tr><td><b>Tipologia</b></td><td>${esc(u.quartos)}</td></tr>
      ${u.area ? `<tr><td><b>Área privativa</b></td><td>${m2(u.area)} m²</td></tr>` : ""}
      ${u.vaga ? `<tr><td><b>Vaga</b></td><td>${esc(u.vaga)}</td></tr>` : ""}
      ${u.pos ? `<tr><td><b>Posição</b></td><td>${esc(u.pos)}${faceMar(u) ? " · face mar" : ""}</td></tr>` : ""}
      <tr><td><b>Localização</b></td><td>${esc(e.endereco || e.bairro + ", " + e.cidade)}</td></tr>
      ${ent ? `<tr><td><b>Entrega</b></td><td>${esc(ent)}</td></tr>` : ""}
      <tr><td><b>Valor</b></td><td><b>${brl(u.valor)}</b></td></tr></table>
      <p class="aviso">${esc(e.tabela)}${e.correcao ? " · " + esc(e.correcao) : ""} · Valores podem mudar sem aviso prévio.</p></section>`);
    S.push(...slidesFluxos(u, `Pagamento · unidade ${u.un} (${brl(u.valor)})`));
    slidesEmpBase(i, S);
    S.push(slideContato(perfil));
    return S;
  }
  /* apresentação geral */
  S.push(`<section class="sl capa" data-sec="Início" ${bg(fotos[0] || "")}><div class="cx"><div class="k">${esc(e.incorp)} · ${esc(e.status)}</div><h1>${esc(e.nome)}</h1>
    <p>${esc(e.endereco || e.bairro + ", " + e.cidade)}</p><p class="big">${esc(i.preco)}${ent ? ` <span style="font-size:.55em;color:#fff">· ${esc(ent)}</span>` : ""}</p></div></section>`);
  slidesEmpBase(i, S);
  if (e._units.length) {
    const g = {}; e._units.forEach((z) => { (g[z.quartos] ||= []).push(z); });
    const linhas = Object.keys(g).sort().map((k) => { const v = g[k].map((z) => z.valor), a = g[k].map((z) => z.area).filter(Boolean);
      return `<tr><td>${esc(k)}</td><td>${a.length ? m2(Math.min(...a)) + (Math.max(...a) > Math.min(...a) ? " a " + m2(Math.max(...a)) : "") + " m²" : ""}</td><td class="v">${g[k].length} disp.</td><td class="v">a partir de ${brl(Math.min(...v))}</td></tr>`; }).join("");
    S.push(`<section class="sl" data-sec="Valores"><div class="k">Unidades e valores</div><h2>Opções disponíveis</h2><table>${linhas}</table><p class="aviso">${esc(e.tabela)} · Valores podem mudar sem aviso prévio.</p></section>`);
    const m = e._units.slice().sort((a, b) => a.valor - b.valor)[0];
    S.push(...slidesFluxos(m, `Exemplo de pagamento · unidade ${m.un} (${brl(m.valor)}) · menor valor disponível`));
  } else if ((x.condicoes || []).length) S.push(`<section class="sl" data-sec="Pagamento"><div class="k">Condições</div><h2>Condições de pagamento</h2>${lista(x.condicoes)}</section>`);
  S.push(slideContato(perfil));
  return S;
}

/* ---------------- link para compartilhar ---------------- */
export function linkCompartilhar(i, unitId, perfil) {
  const q = new URLSearchParams({ i: i.id });
  if (unitId) q.set("u", unitId);
  const p = perfil || {};
  if (p.nome) q.set("n", p.nome); if (p.creci) q.set("c", p.creci); if (p.wpp) q.set("w", p.wpp);
  return location.origin + "/apresentacao/?" + q.toString();
}
export async function compartilhar(url, titulo) {
  if (navigator.share) { try { await navigator.share({ title: titulo, text: titulo, url }); return "ok"; } catch (e) { if (e && e.name === "AbortError") return "cancelado"; } }
  try { await navigator.clipboard.writeText(url); return "copiado"; } catch (e) {}
  window.prompt("Copie o link da apresentação:", url); return "manual";
}

/* ---------------- visualizador (tela cheia) ---------------- */
const CSS = `#rmShow{position:fixed;inset:0;background:#13233F;color:#fff;z-index:9000;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
#rmShow[hidden]{display:none}
#rmShow .top{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:14px;flex-wrap:nowrap}
#rmShow .top .sp{flex:1}#rmShow .sec{display:flex;gap:6px;overflow-x:auto;margin-left:8px}
#rmShow .b{border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:8px;padding:6px 10px;font:600 13px Inter,sans-serif;cursor:pointer;white-space:nowrap}
#rmShow .b.g{background:#C29A4E;border-color:#C29A4E;color:#13233F}
#rmShow .stage{flex:1;position:relative;overflow:hidden}
#rmShow .sl{position:absolute;inset:0;display:none;padding:28px 6vw;overflow:auto}
#rmShow .sl.on{display:flex;flex-direction:column;justify-content:center}
#rmShow .sl.foto{padding:0;background:#0B1528 center/contain no-repeat}
#rmShow .sl.capa{background:#0B1528 center/cover no-repeat;justify-content:flex-end}
#rmShow .sl.capa .cx{background:linear-gradient(transparent,rgba(10,20,40,.92));margin:0 -6vw -28px;padding:60px 6vw 34px}
#rmShow h1,#rmShow h2{font-family:Marcellus,Georgia,serif;font-weight:400}
#rmShow .sl h1{font-size:clamp(30px,5vw,58px);color:#fff;margin:.1em 0}
#rmShow .sl h2{font-size:clamp(24px,3.4vw,40px);color:#E3C98F;margin:0 0 .4em}
#rmShow .sl .k{color:#E3C98F;text-transform:uppercase;letter-spacing:.14em;font-size:13px}
#rmShow .sl p,#rmShow .sl li{font-size:clamp(16px,1.8vw,21px);line-height:1.5}
#rmShow .sl ul{columns:2;column-gap:40px;padding-left:20px}
#rmShow .sl .big{font-size:clamp(28px,4vw,46px);font-family:Marcellus,serif;color:#E3C98F}
#rmShow table{width:100%;border-collapse:collapse}
#rmShow .sl td,#rmShow .sl th{padding:8px;border-bottom:1px solid rgba(255,255,255,.15);color:#fff;text-align:left;font-size:clamp(15px,1.6vw,19px)}
#rmShow .sl td.v{text-align:right;white-space:nowrap}
#rmShow .sl .aviso{font-size:13px;opacity:.75;margin-top:18px}
#rmShow .rmA-wa{display:inline-block;background:#1FA855;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700}
#rmShow .nv{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.35);border:0;color:#fff;font-size:34px;width:52px;height:72px;cursor:pointer;border-radius:8px;z-index:2}
#rmShow .nv.p{left:8px}#rmShow .nv.n{right:8px}
#rmShow .ok{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:#fff;color:#13233F;padding:10px 16px;border-radius:999px;font-weight:600;font-size:14px;z-index:3}
@media(max-width:700px){#rmShow .sl ul{columns:1}#rmShow .tt{display:none}#rmShow .nv{width:40px;height:56px;font-size:26px}#rmShow .fs{display:none}}
@media print{#rmShow{display:none!important}}`;

let EL = null, cur = 0, atual = null;
function montar(opts) {
  if (EL) return EL;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  EL = document.createElement("div"); EL.id = "rmShow"; EL.hidden = true;
  EL.innerHTML = `<div class="top"><b class="tt"></b><span class="sec"></span><span class="sp"></span><span class="nn"></span>
    <button class="b g sh" type="button">Compartilhar</button><button class="b fs" type="button">Tela cheia</button>${opts.semFechar ? "" : '<button class="b x" type="button">Fechar ✕</button>'}</div>
    <div class="stage"><button class="nv p" type="button" aria-label="Anterior">‹</button><button class="nv n" type="button" aria-label="Próximo">›</button></div>`;
  document.body.appendChild(EL);
  const q = (s) => EL.querySelector(s);
  q(".p").onclick = () => ir(cur - 1); q(".n").onclick = () => ir(cur + 1);
  q(".fs").onclick = () => { if (!document.fullscreenElement) EL.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  if (q(".x")) q(".x").onclick = fechar;
  q(".sh").onclick = async () => {
    if (!atual) return;
    const url = linkCompartilhar(atual.i, atual.unitId, atual.perfil);
    const r = await compartilhar(url, atual.titulo);
    if (r === "copiado") aviso("Link copiado! É só colar no WhatsApp do cliente.");
  };
  document.addEventListener("keydown", (ev) => {
    if (EL.hidden) return;
    if (ev.key === "ArrowRight" || ev.key === " ") { ev.preventDefault(); ir(cur + 1); }
    if (ev.key === "ArrowLeft") ir(cur - 1);
    if (ev.key === "Escape" && !document.fullscreenElement && !opts.semFechar) fechar();
  });
  let x0 = null;
  q(".stage").addEventListener("touchstart", (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  q(".stage").addEventListener("touchend", (ev) => { if (x0 == null) return; const dx = ev.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(cur + (dx < 0 ? 1 : -1)); x0 = null; });
  return EL;
}
function aviso(t) { const d = document.createElement("div"); d.className = "ok"; d.textContent = t; EL.querySelector(".stage").appendChild(d); setTimeout(() => d.remove(), 2600); }
function ir(n) {
  const S = [...EL.querySelectorAll(".sl")]; if (!S.length) return;
  cur = Math.max(0, Math.min(S.length - 1, n));
  S.forEach((s, k) => s.classList.toggle("on", k === cur));
  EL.querySelector(".nn").textContent = `${cur + 1} / ${S.length}`;
  EL.querySelector(".p").style.visibility = cur ? "" : "hidden"; EL.querySelector(".n").style.visibility = cur < S.length - 1 ? "" : "hidden";
}
export function fechar() { if (!EL) return; EL.hidden = true; document.body.style.overflow = ""; if (document.fullscreenElement) document.exitFullscreen?.(); }
export function abrir(i, unitId, perfil, opts = {}) {
  montar(opts);
  const u = unitId && i.e ? i.e._units.find((z) => z.id === unitId) : null;
  atual = { i, unitId: u ? unitId : null, perfil, titulo: u ? `${i.nome} · unidade ${u.un}` : i.nome };
  EL.querySelectorAll(".sl").forEach((s) => s.remove());
  EL.querySelector(".stage").insertAdjacentHTML("beforeend", slides(i, atual.unitId, perfil).join(""));
  EL.querySelector(".tt").textContent = atual.titulo;
  const sec = EL.querySelector(".sec");
  sec.innerHTML = [...EL.querySelectorAll(".sl")].map((s, k) => s.dataset.sec ? `<button class="b" type="button" data-go="${k}">${esc(s.dataset.sec)}</button>` : "").join("");
  sec.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => ir(+b.dataset.go)));
  EL.hidden = false; document.body.style.overflow = "hidden";
  ir(0);
}
