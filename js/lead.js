/* Formulário de primeiro contato antes do WhatsApp (Renan Martins Corretor).
   Na primeira vez que a pessoa clica em qualquer botão de WhatsApp, pede nome, e-mail e cidade.
   Os dados vão junto na mensagem do WhatsApp. Nas próximas vezes, abre o WhatsApp direto.
   Todo contato pelo WhatsApp fica salvo na lista de leads (Área do dono). */
(function () {
  var KEY = "rm_lead_v1";
  var NUM = "5547992011013";
  function getLead() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function setLead(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function isWa(a) { return a && a.href && a.href.indexOf("wa.me/" + NUM) > -1; }

  var css = "#rmLead{position:fixed;inset:0;z-index:9999;background:rgba(8,16,30,.72);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#rmLead[hidden]{display:none}" +
    "#rmLead .bx{background:#fff;border-radius:20px;max-width:420px;width:100%;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:'Plus Jakarta Sans',Arial,sans-serif}" +
    "#rmLead .hd{background:#13233F;padding:20px 22px;display:flex;align-items:center;gap:14px}" +
    "#rmLead .hd img{height:42px;width:auto}#rmLead .hd b{color:#fff;font-family:Marcellus,Georgia,serif;font-weight:400;letter-spacing:.1em;font-size:16px;display:block}#rmLead .hd small{color:#D9B56E;font-size:11px;letter-spacing:.14em;text-transform:uppercase}" +
    "#rmLead form{padding:20px 22px 22px}#rmLead p.t{margin:0 0 14px;color:#3B424B;font-size:15px;line-height:1.45}" +
    "#rmLead label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B727C;margin:10px 0 4px}" +
    "#rmLead input{width:100%;box-sizing:border-box;border:1px solid #D3DCE9;border-radius:12px;padding:12px 14px;font-size:16px;font-family:inherit;color:#14181D}" +
    "#rmLead input:focus{outline:2px solid #C29A4E;border-color:#C29A4E}" +
    "#rmLead button.go{margin-top:16px;width:100%;border:0;border-radius:999px;background:#1FA855;color:#fff;font-weight:700;font-size:16px;padding:14px;cursor:pointer;font-family:inherit}" +
    "#rmLead .x{position:absolute;top:10px;right:12px;background:none;border:0;color:#fff;font-size:26px;cursor:pointer;line-height:1}" +
    "#rmLead .lg{font-size:11.5px;color:#6B727C;margin:10px 0 0;line-height:1.4}#rmLead .er{color:#B3261E;font-size:13px;margin-top:8px;min-height:1em}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var box = document.createElement("div");
  box.id = "rmLead"; box.hidden = true;
  box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "rmLeadT");
  box.innerHTML = '<div class="bx" style="position:relative"><div class="hd"><img src="/logo/logo-rm.png" alt=""><span><b>RENAN MARTINS</b><small>Corretor de Imóveis</small></span><button type="button" class="x" aria-label="Fechar">×</button></div>' +
    '<form novalidate><p class="t" id="rmLeadT">Antes de abrir o WhatsApp, me conta rapidinho quem é você. Assim já te atendo direto no que precisa.</p>' +
    '<label for="rmN">Nome</label><input id="rmN" name="nome" autocomplete="name" required>' +
    '<label for="rmE">E-mail</label><input id="rmE" name="email" type="email" autocomplete="email" required>' +
    '<label for="rmC">Cidade onde você mora</label><input id="rmC" name="cidade" autocomplete="address-level2" required>' +
    '<div class="er" aria-live="polite"></div>' +
    '<button class="go" type="submit">Continuar no WhatsApp</button>' +
    '<p class="lg">Seus dados são usados só para o Renan Martins (CRECI 77906F) entrar em contato sobre imóveis.</p></form></div>';
  document.body.appendChild(box);

  var pend = null;
  function close() { box.hidden = true; pend = null; }
  box.querySelector(".x").onclick = close;
  box.addEventListener("click", function (e) { if (e.target === box) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) close(); });

  // Salva cada contato pelo WhatsApp na lista de leads do Renan (Wix CMS "LeadsSite")
  function salvar(L, href, tipo) {
    try {
      var txt = ""; try { txt = new URL(href).searchParams.get("text") || ""; } catch (x) {}
      var chave = "rm_lead_ult", agora = Date.now(), ult = null;
      try { ult = JSON.parse(sessionStorage.getItem(chave) || "null"); } catch (x) {}
      if (ult && ult.t === txt && agora - ult.q < 10 * 60 * 1000) return; // mesmo botão em menos de 10 min
      try { sessionStorage.setItem(chave, JSON.stringify({ t: txt, q: agora })); } catch (x) {}
      import("/js/wix/client.js").then(function (wx) {
        return wx.wixRequest("/wix-data/v2/items", { method: "POST", body: { dataCollectionId: "LeadsSite", dataItem: { data: {
          title: L.nome, email: L.email, cidade: L.cidade, pagina: location.pathname, mensagem: txt, tipo: tipo } } } });
      }).catch(function () {});
    } catch (x) {}
  }

  function withData(href, L) {
    var u; try { u = new URL(href); } catch (e) { return href; }
    var t = u.searchParams.get("text") || "Olá Renan, vim pelo seu site.";
    t += "\n\nMeus dados:\nNome: " + L.nome + "\nE-mail: " + L.email + "\nCidade: " + L.cidade;
    return "https://wa.me/" + NUM + "?text=" + encodeURIComponent(t);
  }

  box.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = box.querySelector("#rmN").value.trim(), m = box.querySelector("#rmE").value.trim(), c = box.querySelector("#rmC").value.trim();
    var er = box.querySelector(".er");
    if (n.length < 2) { er.textContent = "Preencha seu nome."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) { er.textContent = "Confira seu e-mail."; return; }
    if (c.length < 2) { er.textContent = "Preencha sua cidade."; return; }
    var L = { nome: n, email: m, cidade: c, quando: new Date().toISOString() };
    setLead(L);
    salvar(L, pend || "", "Primeiro contato (formulário + WhatsApp)");
    var href = withData(pend || "https://wa.me/" + NUM, L);
    box.hidden = true; pend = null;
    if (window.fbq) try { fbq("track", "Lead"); } catch (x) {}
    if (window.gtag) try { gtag("event", "generate_lead"); } catch (x) {}
    (wo || window.open).call(window, href, "_blank", "noopener") || (location.href = href);
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!isWa(a)) return;
    var L0 = getLead();
    if (L0) { salvar(L0, a.href, "Novo contato pelo WhatsApp"); return; }
    e.preventDefault(); e.stopPropagation();
    pend = a.href; box.hidden = false;
    setTimeout(function () { box.querySelector("#rmN").focus(); }, 30);
  }, true);

  // Links abertos por script (ex.: window.open(wa(...))) também passam pelo formulário
  var wo = window.open;
  window.open = function (u) {
    if (typeof u === "string" && u.indexOf("wa.me/" + NUM) > -1 && getLead()) salvar(getLead(), u, "Novo contato pelo WhatsApp");
    if (typeof u === "string" && u.indexOf("wa.me/" + NUM) > -1 && !getLead() && box.hidden) {
      pend = u; box.hidden = false; return null;
    }
    return wo.apply(window, arguments);
  };
})();
