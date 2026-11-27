// Gera páginas estáticas por empreendimento, sitemap e links para o Google
// a partir dos dados que já estão no index.html (EMPS, UNITS, IMGS).
// Roda no GitHub Actions depois de baixar o site do Wix.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://renanmartinscorretor.com.br";
const WA = "5547992011013";

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// ---------- 1. Ler os dados do site ----------
function lerDados(s) {
  const a = s.indexOf(">", s.lastIndexOf("<script")) + 1;
  const mark = "EMPS.forEach(e=>{e.imgs=IMGS[e.id]||[];});";
  const b = s.indexOf(mark, a);
  if (a <= 0 || b < 0) throw new Error("Não achei os dados no index.html");
  const stub = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub),
    apply: () => stub,
    construct: () => stub,
  });
  const ctx = {
    console, document: stub, window: stub, localStorage: stub, navigator: stub,
    location: { hash: "" }, setTimeout: () => 0, addEventListener: () => 0,
  };
  vm.createContext(ctx);
  vm.runInContext(s.slice(a, b + mark.length) + "\n;globalThis.__D={EMPS,UNITS};", ctx, { timeout: 5000 });
  return ctx.__D;
}

const { EMPS, UNITS } = lerDados(html);

// ---------- 2. Utilidades ----------
const esc = (t) => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const m2 = (v) => (v ? Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " m²" : "");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const entregaTxt = (e) => {
  if (!e.entrega) return e.pronto || e.status === "Pronto" ? "Pronto para morar" : "Data de entrega a confirmar com o Renan";
  const [y, m] = String(e.entrega).split("-");
  return MESES[Number(m) - 1] + "/" + y;
};
const img = (id, w, h) => "https://static.wixstatic.com/media/ad50e8_" + id + "~mv2.jpg/v1/fill/w_" + w + ",h_" + h + ",al_c,q_80,enc_auto/foto.jpg";
const wa = (t) => "https://wa.me/" + WA + "?text=" + encodeURIComponent(t);
const slug = (e) => e.id;
const local = (e) => [e.bairro && e.bairro !== e.cidade ? e.bairro : "", e.cidade + "/SC"].filter(Boolean).join(", ");
const tipos = (us) => {
  const set = [...new Set(us.map((u) => String(u.quartos || "").split("·")[0].trim()).filter(Boolean))];
  return set.join(", ");
};

const CSS = `
:root{--b:#6F1218;--bd:#4A0B10;--g:#B8893F;--n:#254761;--bg:#FBF7F1;--soft:#F4ECE2;--line:#EADFD3;--ink:#1B1B1F;--mute:#6B6670}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Plus Jakarta Sans",Arial,sans-serif;line-height:1.6}
a{color:var(--b)}header{background:var(--b);color:#fff}header .w{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px}
.brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none}.brand img{width:44px;height:44px}
.brand b{display:block;font-family:Marcellus,Georgia,serif;font-weight:400;letter-spacing:.12em;font-size:17px}.brand small{display:block;color:#E8C98E;letter-spacing:.22em;font-size:9.5px;text-transform:uppercase}
.w{max-width:1080px;margin:0 auto;padding:0 20px}.top-cta{background:#fff;color:var(--b);padding:9px 16px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;white-space:nowrap}
.hero{border-radius:22px;overflow:hidden;margin:22px 0;aspect-ratio:16/8;background:#ddd center/cover}
.crumb{font-size:13px;color:var(--mute);margin-top:18px}.crumb a{color:var(--mute)}
h1{font-family:Marcellus,Georgia,serif;font-weight:400;color:var(--b);font-size:clamp(30px,5vw,46px);line-height:1.1;margin:8px 0 6px}
h2{font-family:Marcellus,Georgia,serif;font-weight:400;color:var(--b);font-size:26px;margin:38px 0 12px}
.cap{color:var(--g);text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:600}
.lead{font-size:18px;color:#3B424B}.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:22px 0}
.kv div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px}.kv dt{font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.1em}.kv dd{margin:2px 0 0;font-weight:600}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;border:1px solid var(--line);font-size:14.5px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line)}th{background:var(--soft);font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mute)}
td.v{font-weight:700;white-space:nowrap}.mar{display:inline-block;background:#E9F3F1;color:#0B4F5C;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:600;margin-left:6px}
ul.cols{columns:2;padding-left:18px}@media(max-width:640px){ul.cols{columns:1}.tw{overflow-x:auto}}
.btn{display:inline-block;background:#1E8E5A;color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:700;margin:6px 8px 6px 0}.btn.l{background:#fff;color:var(--b);border:1px solid var(--b)}
.aviso{font-size:13px;color:var(--mute);margin-top:10px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;margin:22px 0}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;display:block}.card .ph{aspect-ratio:16/10;background:#ddd center/cover}.card .tx{padding:14px 16px}.card h3{font-family:Marcellus,Georgia,serif;font-weight:400;color:var(--b);font-size:22px;margin:4px 0}
.avf{background:#F6E9E7;border-top:1px solid #E8D3CF;margin-top:56px;padding:22px 0}.avf .w{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.avf p{margin:0;max-width:78ch;color:#4A0B10;font-size:15px}.avf .btn{background:var(--b);margin:0}
.gal{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:200px 200px;gap:8px;margin:22px 0;border-radius:22px;overflow:hidden;position:relative}.gal button{border:0;padding:0;cursor:zoom-in;background:#ddd center/cover}.gal .g0{grid-row:1/3}.gmore{position:absolute;right:14px;bottom:14px;background:rgba(0,0,0,.65);color:#fff;border-radius:999px;padding:7px 14px;font-weight:600;font-size:14px;cursor:pointer}
@media(max-width:700px){.gal{grid-template-columns:1fr 1fr;grid-template-rows:240px 120px}.gal .g0{grid-column:1/3;grid-row:auto}.gal button:nth-child(n+4){display:none}}
.gridf{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}.gridf button{border:0;padding:0;cursor:zoom-in;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:#ddd}.gridf img{width:100%;height:100%;object-fit:cover;display:block}
.lb{position:fixed;inset:0;background:rgba(10,6,7,.94);z-index:50;display:flex;align-items:center;justify-content:center}.lb[hidden]{display:none}.lb img{max-width:92vw;max-height:86vh;border-radius:8px}.lb button{position:absolute;background:rgba(255,255,255,.12);color:#fff;border:0;width:48px;height:48px;border-radius:50%;font-size:28px;cursor:pointer}.lbx{top:16px;right:16px}.lbp{left:16px}.lbn{right:16px}.lbc{position:absolute;bottom:16px;color:#fff;font-size:14px}
footer{background:var(--bd);color:#E3C9C4;margin-top:0;padding:30px 0;font-size:14px}footer a{color:#F6E9E7}
`;

function pagina({ title, desc, canon, body, ld, image }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
${image ? `<meta property="og:image" content="${image}">` : ""}
<meta name="theme-color" content="#6F1218">
<link rel="icon" href="/monograma.svg" type="image/svg+xml">
<link rel="alternate icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header><div class="w"><a class="brand" href="/"><img src="/monograma.svg" alt="" width="44" height="44"><span><b>RENAN MARTINS</b><small>Corretor de Imóveis</small></span></a>
<a class="top-cta" href="${wa("Olá Renan, vim pelo seu site.")}">WhatsApp</a></div></header>
<main class="w">
${body}
</main>
<div class="avf"><div class="w"><p><b>Valores e disponibilidade podem mudar sem aviso prévio.</b> As informações seguem as tabelas das incorporadoras na data indicada. Antes de decidir, consulte o Renan para confirmar preço, unidade e condições atualizadas.</p><a class="btn" href="${wa("Olá Renan, quero confirmar valores e disponibilidade.")}">Consultar valores atualizados</a></div></div>
<footer><div class="w">
<p><b>Renan Martins · Corretor de Imóveis em Itapoá/SC</b> · CRECI 77906F<br>Cleverson Imóveis LTDA · CRECI-J 6734-J · Av. 780 André Rodrigues de Freitas, 287 · Itapema do Norte, Itapoá/SC</p>
<p>WhatsApp <a href="${wa("Olá Renan, vim pelo seu site.")}">(47) 99201-1013</a> · <a href="https://www.instagram.com/r.martinscorretor/">@r.martinscorretor</a> · <a href="/">Site completo</a> · <a href="/imoveis/">Todos os empreendimentos</a> · <a href="/guia-itapoa.html">Guia de Itapoá</a></p>
<p class="aviso" style="color:#E3C9C4">Valores, disponibilidade e condições conforme as tabelas das incorporadoras na data indicada. Podem mudar sem aviso prévio. Imagens ilustrativas.</p>
</div></footer>
</body>
</html>
`;
}

const AGENTE = {
  "@type": "RealEstateAgent",
  "@id": SITE + "/#corretor",
  name: "Renan Martins · Corretor de Imóveis",
  url: SITE + "/",
  image: SITE + "/apple-touch-icon.png",
  logo: SITE + "/monograma.svg",
  telephone: "+55 47 99201-1013",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. 780 André Rodrigues de Freitas, 287",
    addressLocality: "Itapoá",
    addressRegion: "SC",
    addressCountry: "BR",
  },
  areaServed: ["Itapoá", "Litoral Norte de Santa Catarina"],
  sameAs: [
    "https://www.instagram.com/r.martinscorretor/",
    "https://www.tiktok.com/@renanmartins.cor",
    "https://www.youtube.com/channel/UCJZcB5OzFQ_VAmShAqpu5UQ",
  ],
};

// ---------- 3. Página de cada empreendimento ----------
const gerados = [];
const dirImoveis = path.join(ROOT, "imoveis");
fs.mkdirSync(dirImoveis, { recursive: true });

for (const e of EMPS) {
  const us = UNITS.filter((u) => u.emp === e.id && u.valor).sort((a, b) => a.valor - b.valor);
  const min = us.length ? us[0].valor : null;
  const tp = tipos(us);
  const url = SITE + "/imoveis/" + slug(e) + "/";
  const capa = e.imgs && e.imgs.length ? img(e.imgs[0], 1600, 800) : null;
  const statusTxt = e.status || "";
  const tipoImovel = e.pronto || e.status === "Pronto" ? "Apartamentos prontos" : "Apartamentos na planta";

  const title = `${e.nome} · ${tipoImovel.toLowerCase().replace(/^a/, "A")} em ${local(e)}${min ? " a partir de " + brl(min) : ""} | Renan Martins`;
  const desc = `${e.nome} (${e.incorp}) em ${local(e)}: ${e.resumo || ""} ${min ? "Unidades a partir de " + brl(min) + "." : ""} Entrega: ${entregaTxt(e)}. Tabela e fluxo de pagamento com o corretor Renan Martins.`.replace(/\s+/g, " ").trim().slice(0, 300);

  let b = `<p class="crumb"><a href="/">Início</a> › <a href="/imoveis/">Imóveis em Itapoá</a> › ${esc(e.nome)}</p>`;
  if (capa) b += `<div class="hero" role="img" aria-label="${esc(e.nome)} · imagem ilustrativa" style="background-image:url('${capa}')"></div>`;
  b += `<p class="cap">${esc(e.incorp)} · ${esc(statusTxt)}</p><h1>${esc(e.nome)} · ${esc(local(e))}</h1>`;
  if (e.resumo) b += `<p class="lead">${esc(e.resumo)}</p>`;
  b += `<dl class="kv">
<div><dt>Localização</dt><dd>${esc(e.endereco || local(e))}</dd></div>
<div><dt>Entrega</dt><dd>${esc(entregaTxt(e))}</dd></div>
${tp ? `<div><dt>Tipologias</dt><dd>${esc(tp)}</dd></div>` : ""}
${min ? `<div><dt>A partir de</dt><dd>${brl(min)}</dd></div>` : `<div><dt>Valores</dt><dd>Sob consulta</dd></div>`}
${us.length ? `<div><dt>Unidades disponíveis</dt><dd>${us.length}</dd></div>` : ""}
</dl>`;
  b += `<a class="btn" href="${wa("Olá Renan, vi no seu site o " + e.nome + " e quero saber mais.")}">Quero saber mais pelo WhatsApp</a>`;
  b += `<a class="btn l" href="/#emp-${e.id}">Ver fluxo de pagamento e simulador</a>`;

  if (us.length) {
    b += `<h2>Unidades disponíveis</h2><div class="tw"><table><thead><tr><th>Unidade</th><th>Tipologia</th><th>Área privativa</th><th>Posição</th><th>Valor</th></tr></thead><tbody>`;
    for (const u of us) {
      b += `<tr><td>${esc(u.un)}${u.mar === "fm" ? '<span class="mar">face mar</span>' : ""}</td><td>${esc(u.quartos || "")}</td><td>${m2(u.area)}</td><td>${esc(u.pos || "")}</td><td class="v">${brl(u.valor)}</td></tr>`;
    }
    b += `</tbody></table></div>`;
    b += `<p class="aviso">${esc(e.tabela || "")}${e.tabela ? ". " : ""}${esc(e.aviso || "Valores podem mudar sem aviso prévio.")}</p>`;
  }
  if (e.ficha && e.ficha.length) {
    b += `<h2>Ficha técnica</h2><dl class="kv">` + e.ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") + `</dl>`;
  }
  if (e.lazer && e.lazer.length) b += `<h2>Lazer</h2><ul class="cols">` + e.lazer.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul>`;
  if (e.dif && e.dif.length) b += `<h2>Diferenciais</h2><ul class="cols">` + e.dif.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul>`;
  if (e.condicoes && e.condicoes.length) b += `<h2>Condições de pagamento</h2><ul>` + e.condicoes.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul><p class="aviso">${esc(e.correcao || "")}</p>`;
  b += `<h2>Fale com o corretor</h2><p>Sou o Renan Martins, corretor de imóveis em Itapoá. Te mando a tabela atualizada, o fluxo de pagamento da unidade que você escolher e marco uma visita ao decorado ou ao terreno.</p>
<a class="btn" href="${wa("Olá Renan, vi no seu site o " + e.nome + " e quero saber mais.")}">Chamar no WhatsApp</a>`;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      AGENTE,
      {
        "@type": "Residence",
        name: e.nome,
        description: e.resumo || desc,
        url,
        ...(capa ? { image: capa } : {}),
        address: { "@type": "PostalAddress", streetAddress: e.endereco || "", addressLocality: e.cidade, addressRegion: "SC", addressCountry: "BR" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: "Imóveis em Itapoá", item: SITE + "/imoveis/" },
          { "@type": "ListItem", position: 3, name: e.nome, item: url },
        ],
      },
    ],
  };

  const out = pagina({ title, desc, canon: url, body: b, ld, image: capa });
  const dir = path.join(dirImoveis, slug(e));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), out);
  gerados.push({ e, url, min, capa, tp, n: us.length, tipoImovel });
}

// ---------- 3b. Imóveis à venda (catálogo copiado da Cleverson Imóveis) ----------
const VENDA = [];
{
  let cat = null;
  try { cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cleverson.json"), "utf8")); } catch (e) {}
  const dirVenda = path.join(dirImoveis, "venda");
  if (cat && cat.imoveis && cat.imoveis.length) {
    fs.mkdirSync(dirVenda, { recursive: true });
    const titulo = (t) => (t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s\-\/(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Com|A|Ao|No|Na|Em)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase()) : t);
    const tipoDe = (it) => {
      const t = (it.campos["Tipo de Imóvel"] || "") + " " + it.nome;
      if (/terreno|lote/i.test(t)) return "terreno";
      if (/apartamento|cobertura|studio|kitnet|flat|giardino|garden/i.test(t)) return "apartamento";
      if (/casa|sobrado|geminad|chal[eé]|triplex|duplex/i.test(t)) return "casa";
      return "apartamento";
    };
    const num = (v) => { const m = String(v || "").match(/\d+/); return m ? Number(m[0]) : 0; };
    const areaDe = (c) => {
      for (const [k, suf] of [["Área Privada", "priv."], ["Área Útil", "útil"], ["Área Total", "total"], ["Terreno", "terreno"]]) if (c[k]) return c[k] + " " + suf;
      return "";
    };
    for (const it of cat.imoveis) {
      const c = it.campos || {};
      const tipo = tipoDe(it);
      const est = c["Estágio do Imóvel"] || "";
      const fase = tipo === "apartamento" && est && !/pronto/i.test(est) ? "planta" : "";
      const qm = String(c["Quartos"] || c["Quarto"] || "").match(/(\d+)(?:.*?(\d+)\s*su[ií]te)?/i);
      const q = qm ? Number(qm[1]) : it.quartos || 0;
      const s2 = qm && qm[2] ? Number(qm[2]) : 0;
      const v = num(c["Vagas"] || c["Vaga"]);
      const nome = titulo(it.nome);
      const local2 = [it.bairro, it.cidade].filter(Boolean).join(", ");
      const url = SITE + "/imoveis/venda/" + it.id + "/";
      VENDA.push({ it, nome, tipo, fase, est, q, s: s2, v, area: areaDe(c), url, local: local2 });
    }
    for (const g of VENDA) {
      const { it } = g;
      const c = it.campos || {};
      const desc = (it.descricao || "").split(/\n+/).map((l) => l.trim()).filter((l) => l && !/saiba mais|clique (aqui|em)/i.test(l));
      const fotos = it.fotos || [];
      const tipoTxt = g.tipo === "terreno" ? "Terreno" : g.tipo === "casa" ? "Casa" : g.fase ? "Apartamento na planta" : "Apartamento";
      const title = `${g.nome} · ${tipoTxt.toLowerCase()} à venda em ${g.local}${it.preco ? " · " + brl(it.preco) : ""} | Renan Martins`;
      const descMeta = (`${tipoTxt} à venda em ${g.local}` + (it.preco ? ` por ${brl(it.preco)}` : "") + ". " + desc.join(" ")).replace(/\s+/g, " ").slice(0, 290);
      const ficha = [
        ["Tipo", c["Tipo de Imóvel"] ? c["Tipo de Imóvel"].replace(/^Residencial\s*»\s*/, "") : tipoTxt],
        ["Estágio", g.est],
        ["Quartos", c["Quartos"] || c["Quarto"]],
        ["Banheiros", c["Banheiros"] || c["Banheiro"]],
        ["Vagas", c["Vagas"] || c["Vaga"]],
        ["Área privativa", c["Área Privada"]],
        ["Área útil", c["Área Útil"]],
        ["Área total", c["Área Total"]],
        ["Terreno", c["Terreno"]],
        ["Frente × fundos", c["Largura da Frente"] && c["Largura dos Fundos"] ? c["Largura da Frente"] + " × " + c["Largura dos Fundos"] : ""],
        ["Distância do mar", c["Distância do Mar (m)"] ? c["Distância do Mar (m)"] + " m" : ""],
        ["Mobília", c["Mobílias"]],
        ["Construtora", c["Construtora"]],
        ["Entrega", c["Data de Entrega"]],
        ["Ano de construção", c["Ano de Construção"]],
        ["Andar", c["Número do Andar"]],
        ["Bairro", it.bairro],
        ["Cidade", it.cidade ? it.cidade + "/SC" : ""],
      ].filter(([, v]) => v);
      const msg = `Olá Renan, vi no seu site o imóvel "${g.nome}" (${g.local}${it.preco ? ", " + brl(it.preco) : ""}) e quero saber mais.`;
      let b = `<p class="crumb"><a href="/">Início</a> › <a href="/imoveis/">Imóveis em Itapoá</a> › <a href="/imoveis/#venda">À venda</a> › ${esc(g.nome)}</p>`;
      if (fotos.length) {
        b += `<div class="gal"><button class="g0" data-i="0" style="background-image:url('${fotos[0]}')" aria-label="Ampliar foto 1"></button>` +
          fotos.slice(1, 5).map((f, n) => `<button data-i="${n + 1}" style="background-image:url('${f}')" aria-label="Ampliar foto ${n + 2}"></button>`).join("") +
          (fotos.length > 5 ? `<span class="gmore">+${fotos.length - 5} fotos</span>` : "") + `</div>`;
      }
      b += `<p class="cap">${esc(tipoTxt)}${g.est && !/pronto/i.test(g.est) ? " · " + esc(g.est) : g.est ? " · Pronto" : ""}</p><h1>${esc(g.nome)}</h1><p class="lead">${esc(g.local)}</p>`;
      b += `<dl class="kv">${it.preco ? `<div><dt>Valor</dt><dd>${brl(it.preco)}</dd></div>` : `<div><dt>Valor</dt><dd>Sob consulta</dd></div>`}` +
        (g.q ? `<div><dt>Quartos</dt><dd>${g.q}${g.s ? ` (${g.s} suíte${g.s > 1 ? "s" : ""})` : ""}</dd></div>` : "") +
        (g.v ? `<div><dt>Vagas</dt><dd>${g.v}</dd></div>` : "") + (g.area ? `<div><dt>Área</dt><dd>${esc(g.area)}</dd></div>` : "") + `</dl>`;
      b += `<a class="btn" href="${wa(msg)}">Tenho interesse · WhatsApp</a>`;
      if (desc.length) b += `<h2>Sobre o imóvel</h2>` + desc.map((l) => `<p>${esc(l)}</p>`).join("");
      b += `<h2>Ficha do imóvel</h2><dl class="kv">` + ficha.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") + `</dl>`;
      if (it.comodidades && it.comodidades.length) b += `<h2>Comodidades</h2><ul class="cols">` + it.comodidades.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul>`;
      if (it.geo) b += `<p><a href="https://www.google.com/maps?q=${it.geo.lat},${it.geo.lng}" target="_blank" rel="noopener">Ver localização aproximada no mapa ↗</a></p>`;
      if (fotos.length > 1) b += `<h2>Todas as fotos (${fotos.length})</h2><div class="gridf">` + fotos.map((f, n) => `<button data-i="${n}" aria-label="Ampliar foto ${n + 1}"><img src="${f}" alt="${esc(g.nome)} · foto ${n + 1}" loading="lazy"></button>`).join("") + `</div>`;
      b += `<p class="aviso">Imóvel do portfólio da Cleverson Imóveis LTDA (CRECI-J 6734-J), atendimento do corretor Renan Martins (CRECI 77906F). Valor e disponibilidade podem mudar sem aviso prévio.</p>`;
      if (fotos.length) b += `<div class="lb" id="lb" hidden><button class="lbx" aria-label="Fechar">×</button><button class="lbp" aria-label="Foto anterior">‹</button><img alt=""><button class="lbn" aria-label="Próxima foto">›</button><span class="lbc"></span></div>
<script>(()=>{const F=${JSON.stringify(fotos)};const lb=document.getElementById('lb'),im=lb.querySelector('img'),c=lb.querySelector('.lbc');let i=0;const show=n=>{i=(n+F.length)%F.length;im.src=F[i];c.textContent=(i+1)+' / '+F.length;lb.hidden=false;};document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>show(+b.dataset.i));const g=document.querySelector('.gmore');if(g)g.onclick=()=>show(5);lb.querySelector('.lbx').onclick=()=>lb.hidden=true;lb.querySelector('.lbp').onclick=()=>show(i-1);lb.querySelector('.lbn').onclick=()=>show(i+1);lb.onclick=e=>{if(e.target===lb)lb.hidden=true};document.addEventListener('keydown',e=>{if(lb.hidden)return;if(e.key==='Escape')lb.hidden=true;if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight')show(i+1);});})();</script>`;
      const ld = {
        "@context": "https://schema.org",
        "@graph": [AGENTE, {
          "@type": "RealEstateListing", name: g.nome, url: g.url, description: desc.join(" ").slice(0, 500),
          ...(fotos.length ? { image: fotos.slice(0, 6).map((f) => SITE + f) } : {}),
          ...(it.preco ? { offers: { "@type": "Offer", price: it.preco, priceCurrency: "BRL" } } : {}),
          address: { "@type": "PostalAddress", addressLocality: it.cidade, addressRegion: "SC", addressCountry: "BR" },
        }, { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: "Imóveis em Itapoá", item: SITE + "/imoveis/" },
          { "@type": "ListItem", position: 3, name: g.nome, item: g.url }] }],
      };
      const d = path.join(dirVenda, it.id);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, "index.html"), pagina({ title, desc: descMeta, canon: g.url, body: b, ld, image: it.capa ? SITE + it.capa : null }));
    }
    const ids = new Set(VENDA.map((g) => g.it.id));
    for (const d of fs.readdirSync(dirVenda)) {
      const p = path.join(dirVenda, d);
      if (fs.statSync(p).isDirectory() && !ids.has(d)) fs.rmSync(p, { recursive: true, force: true });
    }
  }
}

// ---------- 4. Página com todos os empreendimentos ----------
{
  const url = SITE + "/imoveis/";
  let b = `<p class="crumb"><a href="/">Início</a> › Imóveis em Itapoá</p>
<p class="cap">Itapoá · Litoral Norte de Santa Catarina</p>
<h1>Imóveis à venda em Itapoá/SC</h1>
<p class="lead">Apartamentos na planta, lançamentos e imóveis prontos em Itapoá, com tabela vigente e fluxo de pagamento por unidade. Atendimento do corretor Renan Martins, da primeira conversa às chaves.</p>
<div class="cards">`;
  for (const g of gerados) {
    const e = g.e;
    b += `<a class="card" href="/imoveis/${slug(e)}/">${g.capa ? `<div class="ph" style="background-image:url('${img(e.imgs[0], 800, 500)}')"></div>` : ""}<div class="tx"><span class="cap">${esc(e.incorp)} · ${esc(e.status)}</span><h3>${esc(e.nome)}</h3><p>${esc(local(e))} · Entrega ${esc(entregaTxt(e))}${g.min ? `<br><b>A partir de ${brl(g.min)}</b>` : ""}</p></div></a>`;
  }
  b += `</div>`;
  if (VENDA.length) {
    b += `<h2 id="venda">Casas, terrenos e apartamentos à venda</h2><p>Imóveis prontos e oportunidades em Itapoá e região, com fotos e ficha completa.</p><div class="cards">`;
    for (const g of VENDA) {
      b += `<a class="card" href="/imoveis/venda/${g.it.id}/">${g.it.capa ? `<div class="ph" style="background-image:url('${g.it.capa}')"></div>` : ""}<div class="tx"><span class="cap">${esc(g.tipo === "terreno" ? "Terreno" : g.tipo === "casa" ? "Casa" : g.fase ? "Apartamento na planta" : "Apartamento")}</span><h3>${esc(g.nome)}</h3><p>${esc(g.local)}${[g.q ? g.q + " quarto" + (g.q > 1 ? "s" : "") : "", g.area].filter(Boolean).length ? "<br>" + esc([g.q ? g.q + " quarto" + (g.q > 1 ? "s" : "") : "", g.area].filter(Boolean).join(" · ")) : ""}${g.it.preco ? `<br><b>${brl(g.it.preco)}</b>` : ""}</p></div></a>`;
    }
    b += `</div>`;
  }
  b += `<p class="aviso">Valores podem mudar sem aviso prévio.</p>`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      AGENTE,
      {
        "@type": "ItemList",
        name: "Imóveis à venda em Itapoá/SC",
        itemListElement: gerados.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: g.url, name: g.e.nome })),
      },
    ],
  };
  fs.writeFileSync(path.join(dirImoveis, "index.html"), pagina({
    title: "Imóveis à venda em Itapoá/SC · apartamentos na planta e prontos | Renan Martins",
    desc: "Apartamentos na planta, lançamentos e imóveis prontos em Itapoá/SC: " + gerados.map((g) => g.e.nome).join(", ") + ". Tabela, fluxo de pagamento e atendimento do corretor Renan Martins.",
    canon: url, body: b, ld,
  }));
}

// ---------- 5. Remover páginas de empreendimentos que saíram do site ----------
const ids = new Set(EMPS.map(slug));
for (const d of fs.readdirSync(dirImoveis)) {
  const p = path.join(dirImoveis, d);
  if (fs.statSync(p).isDirectory() && !ids.has(d) && d !== "venda") fs.rmSync(p, { recursive: true, force: true });
}

// ---------- 6. Links no rodapé do site principal (para o Google achar as páginas) ----------
{
  const A = "<!--seo-links-->", B = "<!--/seo-links-->";
  const bloco = `${A}<nav aria-label="Imóveis por empreendimento" style="max-width:1200px;margin:0 auto;padding:18px 20px 0;font-size:13px;line-height:1.9;opacity:.85">Imóveis em Itapoá: ` +
    gerados.map((g) => `<a href="/imoveis/${slug(g.e)}/">${esc(g.e.nome)}</a>`).join(" · ") +
    ` · <a href="/imoveis/">todos os empreendimentos</a></nav>${B}`;
  let s = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const i = s.indexOf(A), j = s.indexOf(B);
  if (i >= 0 && j > i) s = s.slice(0, i) + bloco + s.slice(j + B.length);
  else s = s.replace("</footer>", bloco + "\n</footer>");
  fs.writeFileSync(path.join(ROOT, "index.html"), s);
}

// ---------- 6b. Catálogo de imóveis à venda dentro do site principal ----------
if (VENDA.length) {
  let s2 = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const i = s2.indexOf("const CLV=");
  const j = s2.indexOf("]];", i);
  if (i > 0 && j > i) {
    const rows = VENDA.map((g) => [g.it.id + "/", g.nome, g.tipo, g.it.bairro || "", g.it.cidade || "", g.it.preco || 0, 0, g.q, g.s, g.v, g.area, g.it.capa || "", g.fase, g.est && !/pronto/i.test(g.est) ? g.est : ""]);
    s2 = s2.slice(0, i) + "const CLV=" + JSON.stringify(rows) + ";" + s2.slice(j + 3);
    s2 = s2.replace("const CLV_URL='https://cleversonimoveis.com.br/';", "const CLV_URL='/imoveis/venda/';");
    s2 = s2.split('href="${CLV_URL+o.slug}" target="_blank" rel="noopener"').join('href="${CLV_URL+o.slug}"');
    s2 = s2.replace("Ver fotos ↗</span>", "Ver fotos</span>").replace("Fotos e detalhes ↗</a>", "Fotos e detalhes</a>");
    fs.writeFileSync(path.join(ROOT, "index.html"), s2);
  }
}

// ---------- 7. Sitemap e robots ----------
const urls = [SITE + "/", SITE + "/imoveis/", ...gerados.map((g) => g.url), ...VENDA.map((g) => g.url), SITE + "/guia-itapoa.html"];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log("Páginas geradas:", gerados.length, "| URLs no sitemap:", urls.length);
