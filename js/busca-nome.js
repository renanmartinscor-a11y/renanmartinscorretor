/* Busca de empreendimento pelo nome (Renan Martins Corretor).
   Nos campos de busca do site, mostra sugestões com o nome do empreendimento, a cidade e o valor "a partir de". */
(function () {
  var DATA = null;
  var norm = function (t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); };
  var brl = function (v) { return "R$ " + Math.round(v).toLocaleString("pt-BR"); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var css = ".bn-box{position:absolute;z-index:60;left:0;right:0;top:100%;margin-top:6px;background:#fff;border:1px solid #D3DCE9;border-radius:14px;box-shadow:0 16px 40px rgba(11,22,40,.18);overflow:hidden;max-height:360px;overflow-y:auto}" +
    ".bn-box a{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;text-decoration:none;color:#14181D;border-bottom:1px solid #EEF2F7;font-size:15px}" +
    ".bn-box a:last-child{border-bottom:0}.bn-box a:hover,.bn-box a.on{background:#F4F7FB}" +
    ".bn-box b{display:block;font-weight:600}.bn-box small{color:#6B727C;font-size:12.5px}.bn-box .bn-v{text-align:right;color:#13233F;font-weight:600;white-space:nowrap;font-size:13.5px}" +
    ".bn-box .bn-v small{display:block;font-weight:400}.bn-hd{padding:8px 16px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C29A4E;background:#FBF8F2}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function load() {
    if (DATA) return Promise.resolve(DATA);
    return fetch("/data/corretores.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
      var min = {};
      d.units.forEach(function (u) { if (!min[u.emp] || u.valor < min[u.emp]) min[u.emp] = u.valor; });
      DATA = d.emps.map(function (e) { return { e: e, min: min[e.id] || null, k: norm(e.nome + " " + e.incorp + " " + e.cidade + " " + e.bairro) }; });
      return DATA;
    });
  }

  function match(q) {
    var t = norm(q); if (t.length < 2) return [];
    var words = t.split(/\s+/);
    return DATA.filter(function (x) { return words.every(function (w) { return x.k.indexOf(w) > -1; }); })
      .sort(function (a, b) { return (norm(a.e.nome).indexOf(t) === 0 ? 0 : 1) - (norm(b.e.nome).indexOf(t) === 0 ? 0 : 1); })
      .slice(0, 8);
  }

  function go(x) {
    var target = document.getElementById("emp-" + x.e.id) || document.querySelector('[id="emp"]');
    if (location.pathname === "/" || /index\.html$/.test(location.pathname)) location.hash = "emp-" + x.e.id;
    else location.href = x.e.url;
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }

  function attach(input) {
    if (!input || input.dataset.bn) return;
    input.dataset.bn = "1";
    input.setAttribute("autocomplete", "off");
    var wrap = input.parentElement; if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    var box = document.createElement("div"); box.className = "bn-box"; box.hidden = true; box.setAttribute("role", "listbox");
    wrap.appendChild(box);
    var res = [], sel = -1;
    function render() {
      if (!res.length) { box.hidden = true; return; }
      box.innerHTML = '<div class="bn-hd">Empreendimentos</div>' + res.map(function (x, i) {
        return '<a href="' + esc(x.e.url) + '" data-i="' + i + '" role="option"' + (i === sel ? ' class="on"' : "") + '><span><b>' + esc(x.e.nome) + '</b><small>' + esc(x.e.incorp) + ' · ' + esc(x.e.bairro ? x.e.bairro + ", " : "") + esc(x.e.cidade) + '</small></span>' +
          '<span class="bn-v">' + (x.min ? '<small>a partir de</small>' + brl(x.min) : 'Sob consulta') + '</span></a>';
      }).join("");
      box.hidden = false;
    }
    input.addEventListener("input", function () { load().then(function () { res = match(input.value); sel = -1; render(); }); });
    input.addEventListener("focus", function () { if (input.value) load().then(function () { res = match(input.value); render(); }); });
    input.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "ArrowDown") { sel = Math.min(res.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && sel > -1) { e.preventDefault(); box.hidden = true; go(res[sel]); }
      else if (e.key === "Escape") box.hidden = true;
    });
    box.addEventListener("mousedown", function (e) {
      var a = e.target.closest("a[data-i]"); if (!a) return;
      e.preventDefault(); box.hidden = true; go(res[+a.dataset.i]);
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) box.hidden = true; });
    var form = input.form;
    if (form) form.addEventListener("submit", function (e) {
      if (!DATA) return;
      var t = norm(input.value), hit = DATA.filter(function (x) { return norm(x.e.nome) === t; })[0] || (res.length === 1 ? res[0] : null);
      if (hit) { e.preventDefault(); e.stopImmediatePropagation(); box.hidden = true; go(hit); }
    }, true);
  }

  function init() {
    ["qText", "sText"].forEach(function (id) { attach(document.getElementById(id)); });
    var q = document.getElementById("qText");
    if (q && !/nome do empreendimento/i.test(q.placeholder)) q.placeholder = "Nome do empreendimento, frente mar, 3 suítes…";
    var s = document.getElementById("sText");
    if (s) s.placeholder = "Nome do empreendimento, unidade, garden…";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
