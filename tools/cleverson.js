// Copia os imóveis à venda do site da Cleverson Imóveis (autorizado pelo Renan)
// para dentro do site do Renan: dados em data/cleverson.json e fotos em fotos/<slug>/.
// Roda no GitHub Actions. Baixa só as fotos novas; remove o que saiu do ar.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = "https://cleversonimoveis.com.br";
const DATA = path.join(ROOT, "data", "cleverson.json");
const FOTOS = path.join(ROOT, "fotos");
const UA = "Mozilla/5.0 (compatible; RenanMartinsSite/1.0; +https://renanmartinscorretor.com.br)";
const FORCE = process.argv.includes("--force");
const MAX_FOTOS = 40;
const VERSAO = 3;

let sharp;
try { sharp = require("sharp"); } catch (e) { sharp = null; }

// Bairro/cidade do catálogo anterior (index.html baixado do Wix), usado só quando o anúncio não informa
const ANTIGO_CLV = {};
try {
  const ix = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const a = ix.indexOf("const CLV=");
  const b = ix.indexOf("]];", a);
  if (a > 0 && b > a) for (const r of JSON.parse(ix.slice(a + 10, b + 2))) ANTIGO_CLV[String(r[0]).replace(/\/$/, "")] = { bairro: r[3], cidade: r[4] };
} catch (e) {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const strip = (h) => String(h || "")
  .replace(/<span class="buildingId">[\s\S]*?<\/span>/g, "")
  .replace(/<span class="ImovelFavorito[\s\S]*?<\/span>\s*<\/span>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&raquo;/g, "»").replace(/&laquo;/g, "«").replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª").replace(/&sup2;/g, "²").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/»/g, "»").replace(/\s+/g, " ").trim();

async function get(url, binary) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      if (t === 2) throw e;
      await sleep(1500 * (t + 1));
    }
  }
}

function parseListing(html, slug) {
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch (e) { return null; } })
    .filter(Boolean);
  const L = lds.find((o) => o["@type"] === "RealEstateListing");
  if (!L || !L.name) return null;
  const cut = html.split("Não é o que você queria")[0];
  const rows = {};
  for (const m of cut.matchAll(/<td class="Label[^"]*">((?:(?!<td)[\s\S])*?)<\/td>\s*<td class="Value[^"]*">([\s\S]*?)<\/td>/g)) {
    const k = strip(m[1]).replace(/:$/, "");
    const v = strip(m[2]);
    if (k && v && !(k in rows) && k !== "Mapa") rows[k] = v;
  }
  const imgs = Array.isArray(L.image) ? L.image : L.image ? [L.image] : [];
  // Bairro/cidade pelo título da página ("... para venda | Bairro, Cidade, Estado | ...")
  const tm = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const partes = (tm.split("|")[1] || "").split(",").map((x) => strip(x)).filter(Boolean);
  const tCidade = partes.length >= 2 ? partes[partes.length - 2] : "";
  const tBairro = partes.length >= 3 ? partes[partes.length - 3] : "";
  const ant = ANTIGO_CLV[slug] || {};
  return {
    slug,
    id: safeSlug(slug),
    nome: L.name,
    descricao: L.description || "",
    preco: L.offers && L.offers.price ? Number(L.offers.price) : 0,
    quartos: L.numberOfBedroomsTotal || 0,
    banheiros: L.numberOfBathroomsTotal || 0,
    endereco: (L.address && L.address.streetAddress) || "",
    cidade: rows["Cidade"] || (L.address && L.address.addressLocality) || tCidade || ant.cidade || "",
    bairro: rows["Bairro"] || tBairro || ant.bairro || "",
    geo: L.geo && L.geo.latitude ? { lat: Number(L.geo.latitude), lng: Number(L.geo.longitude) } : null,
    comodidades: (L.amenityFeature || []).map((a) => (a && (a.name || a.value)) || a).filter((x) => typeof x === "string"),
    publicado: L.datePosted || "",
    campos: rows,
    fotosOrigem: imgs.slice(0, MAX_FOTOS),
  };
}

async function salvarFoto(buf, destino, largura, altura) {
  if (!sharp) { fs.writeFileSync(destino, buf); return; }
  let img = sharp(buf, { failOn: "none" }).rotate();
  img = altura ? img.resize(largura, altura, { fit: "cover", position: "attention" }) : img.resize({ width: largura, height: largura, fit: "inside", withoutEnlargement: true });
  await img.jpeg({ quality: 74, mozjpeg: true, progressive: true }).toFile(destino);
}

(async () => {
  let antigo = null;
  try { antigo = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (e) {}
  if (antigo && !FORCE) {
    const idade = (Date.now() - Date.parse(antigo.atualizado)) / 36e5;
    if (idade < 20 && antigo.versao === VERSAO) { console.log("Cleverson: dados de " + idade.toFixed(1) + "h atrás, nada a fazer."); return; }
  }

  const sm = await get(BASE + "/sitemap/buildings.xml");
  const slugs = [...new Set([...sm.matchAll(/<loc>https:\/\/cleversonimoveis\.com\.br\/([^<]+)<\/loc>/g)].map((m) => m[1]))];
  if (slugs.length < 10) throw new Error("Sitemap da Cleverson veio com poucos imóveis (" + slugs.length + "); abortando para não apagar o catálogo.");

  const imoveis = [];
  let i = 0;
  async function worker() {
    while (i < slugs.length) {
      const s = slugs[i++];
      try {
        const html = await get(BASE + "/" + s);
        if (!html) continue;
        const it = parseListing(html, s);
        if (it) imoveis.push(it);
      } catch (e) { console.log("Falha em", s, e.message); }
      await sleep(250);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (imoveis.length < 10) throw new Error("Poucos imóveis lidos (" + imoveis.length + "); abortando.");

  // Fotos
  fs.mkdirSync(FOTOS, { recursive: true });
  const fila = [];
  for (const it of imoveis) {
    const dir = path.join(FOTOS, it.id);
    fs.mkdirSync(dir, { recursive: true });
    it.fotos = [];
    const anterior = antigo && (antigo.imoveis || []).find((x) => x.id === it.id);
    const mesmas = anterior && JSON.stringify(anterior.fotosOrigem) === JSON.stringify(it.fotosOrigem);
    it.fotosOrigem.forEach((url, n) => {
      const nome = String(n + 1).padStart(2, "0") + ".jpg";
      const destino = path.join(dir, nome);
      it.fotos.push("/fotos/" + it.id + "/" + nome);
      if (!mesmas || !fs.existsSync(destino)) fila.push({ url, destino, capa: n === 0 ? path.join(dir, "capa.jpg") : null });
    });
    if (!it.fotosOrigem.length) it.fotos = [];
    // limpa fotos que sobraram de uma versão anterior com mais fotos
    for (const f of fs.readdirSync(dir)) {
      if (f !== "capa.jpg" && !it.fotos.includes("/fotos/" + it.id + "/" + f)) fs.rmSync(path.join(dir, f));
    }
  }
  console.log("Fotos para baixar:", fila.length);
  let j = 0, okF = 0;
  async function baixa() {
    while (j < fila.length) {
      const f = fila[j++];
      try {
        const buf = await get(f.url, true);
        if (!buf) continue;
        await salvarFoto(buf, f.destino, 1400);
        if (f.capa) await salvarFoto(buf, f.capa, 800, 600);
        okF++;
      } catch (e) { console.log("Foto falhou", f.url, e.message); }
    }
  }
  await Promise.all([baixa(), baixa(), baixa(), baixa()]);
  console.log("Fotos baixadas:", okF);

  // Garante capa para quem já tinha fotos
  for (const it of imoveis) {
    const capa = path.join(FOTOS, it.id, "capa.jpg");
    const primeira = path.join(FOTOS, it.id, "01.jpg");
    if (!fs.existsSync(capa) && fs.existsSync(primeira)) await salvarFoto(fs.readFileSync(primeira), capa, 800, 600);
    it.capa = fs.existsSync(capa) ? "/fotos/" + it.id + "/capa.jpg" : "";
    it.fotos = it.fotos.filter((p) => fs.existsSync(path.join(ROOT, p)));
  }

  // Remove pastas de imóveis que saíram do ar
  const ids = new Set(imoveis.map((x) => x.id));
  for (const d of fs.readdirSync(FOTOS)) if (!ids.has(d)) fs.rmSync(path.join(FOTOS, d), { recursive: true, force: true });

  imoveis.sort((a, b) => (a.cidade === "Itapoá" ? 0 : 1) - (b.cidade === "Itapoá" ? 0 : 1) || a.preco - b.preco);
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify({ versao: VERSAO, atualizado: new Date().toISOString(), fonte: BASE, imoveis }, null, 1));
  console.log("Cleverson: " + imoveis.length + " imóveis salvos.");
})().catch((e) => { console.error(e); process.exit(1); });
