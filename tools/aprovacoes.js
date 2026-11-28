// Aprovação de corretores pelo site (roda no GitHub Actions a cada poucos minutos).
// 1) Executa as decisões que o Renan clicou na Área do dono (coleção DecisoesAcesso).
//    Só vale decisão criada pelo próprio Renan (_owner = membro dele); as outras são ignoradas.
// 2) Atualiza a lista de pedidos pendentes que aparece para ele (coleção PedidosAcesso,
//    visível só para ele: permissão "autor" + _owner = Renan).
// Precisa do segredo WIX_API_KEY (chave de API do Wix com Wix Data + Gerenciamento de membros).

const KEY = process.env.WIX_API_KEY;
const SITE = "2fc06920-8f11-4c24-aba5-8949b216f92e";
const DONO = "ad50e81c-50a0-4fc6-9e87-99db4bce5233"; // membro renanmartinscor@gmail.com
const API = "https://www.wixapis.com";

if (!KEY) { console.log("Sem WIX_API_KEY: nada a fazer."); process.exit(0); }

async function wix(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: KEY, "wix-site-id": SITE, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
const query = async (col, filter) =>
  ((await wix("POST", "/wix-data/v2/items/query", { dataCollectionId: col, query: { filter: filter || {}, paging: { limit: 100 } } })).dataItems || []);

(async () => {
  const cads = await query("CadastroCorretor");
  const cadDe = (email) => cads.filter((c) => (c.data.email || "").toLowerCase() === (email || "").toLowerCase()).pop()?.data || {};
  // 1) decisões
  const dec = await query("DecisoesAcesso", { processado: { $ne: "sim" } });
  for (const it of dec) {
    const d = it.data, id = d.memberId;
    let res = "ignorado";
    if (d._owner === DONO && id) {
      try {
        if (d.title === "aprovar") {
          const ap = await wix("POST", `/members/v1/members/${id}/approve`, {});
          res = "sim";
          // cria o perfil do corretor (celular e CRECI do cadastro), visível só para ele
          const mem = ap.member || {}, cad = cadDe(mem.loginEmail);
          const ja = await query("PerfilCorretor", { _owner: id });
          if (!ja.length) await wix("POST", "/wix-data/v2/items", { dataCollectionId: "PerfilCorretor", dataItem: { data: {
            title: cad.title || [mem.contact?.firstName, mem.contact?.lastName].filter(Boolean).join(" "), email: mem.loginEmail || "",
            celular: cad.celular || "", creci: cad.creci || "", _owner: id } } });
        }
        else res = "ignorado";
      } catch (e) { console.log("Falha ao aprovar", id, e.message); res = /404/.test(e.message) ? "sim" : ""; }
    }
    if (res) await wix("PUT", `/wix-data/v2/items/${it.id}`, { dataCollectionId: "DecisoesAcesso", dataItem: { id: it.id, data: { ...d, processado: res } } });
    console.log("Decisão", d.title, id, "→", res || "tentar de novo");
  }

  // 2) pedidos pendentes (lista do Renan)
  const m = await wix("POST", "/members/v1/members/query", { query: { filter: { status: "PENDING" }, paging: { limit: 100 } }, fieldsets: ["FULL"] });
  const pend = m.members || [];
  const atuais = await query("PedidosAcesso");
  const porMembro = new Map(atuais.map((i) => [i.data.memberId, i]));
  const ids = new Set(pend.map((x) => x.id));
  for (const i of atuais) if (!ids.has(i.data.memberId)) await wix("DELETE", `/wix-data/v2/items/${i.id}?dataCollectionId=PedidosAcesso`);
  for (const x of pend) {
    if (porMembro.has(x.id)) continue;
    const c = x.contact || {};
    await wix("POST", "/wix-data/v2/items", { dataCollectionId: "PedidosAcesso", dataItem: { data: {
      title: [c.firstName, c.lastName].filter(Boolean).join(" ") || x.profile?.nickname || x.loginEmail,
      memberId: x.id, email: x.loginEmail || "", celular: cadDe(x.loginEmail).celular || (c.phones || [])[0] || "", creci: cadDe(x.loginEmail).creci || "",
      pedidoEm: x.createdDate || "", status: "pendente", _owner: DONO } } });
  }
  console.log(`Pendentes: ${pend.length} · decisões processadas: ${dec.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
