/* ══════════════════════════════════════════════════════════════════
   HOOPORIA MOBI — PLAYER PROGRESS REPORT

   One report, two doors: the player opens his own (report.html, with
   his device's private key) and the coach opens any of his players'
   (Coach View → a player → Progress report). Both draw it from here,
   so they always match.

   Spanish first, with an English toggle (for the programs the players
   are heading to); laid out to print or save as a PDF on one page, and
   to share as a picture (WhatsApp, email…) straight from the phone.
   ══════════════════════════════════════════════════════════════════ */
(function(){
  var GAMES = [
    { k: 'recall',      n: 'The Recall',      d: { en: 'Visual memory — a pattern flashes at once, then is rebuilt in order.', es: 'Memoria visual — un patrón aparece de una vez y se reconstruye en orden.' } },
    { k: 'recognition', n: 'The Recognition', d: { en: 'Change detection — spot what changed between a pattern and its echo.', es: 'Detección de cambios — descubre qué cambió entre un patrón y su eco.' } },
    { k: 'replay',      n: 'The Replay',      d: { en: 'Working memory — a sequence that keeps growing by one each round.', es: 'Memoria de trabajo — una secuencia que crece uno más cada ronda.' } },
    { k: 'fortress',    n: 'The Fortress',    d: { en: 'Sequence recall under load — repeat longer and longer target chains.', es: 'Secuencias bajo carga — repite cadenas cada vez más largas.' } }
  ];
  var TX = {
    es: { title: 'Reporte de Progreso del Jugador', age: 'Edad', days: 'Días de entrenamiento', sessions: 'Sesiones', first: 'Primera', latest: 'Última', best: 'Mejor',
          gain: 'Primera → mejor', notYet: 'Todavía sin entrenar.', one: 'Una sesión hasta ahora — la gráfica empieza con la segunda.',
          foot: 'Las puntuaciones son los puntos ganados en cada estación; una cadena más larga o más rápida suma más. Generado el ',
          print: '🖨 Imprimir / PDF', share: '📤 Compartir', making: 'Preparando…', saved: 'Imagen guardada — compártela desde tus fotos o descargas.', fail: 'No se pudo compartir — usa Imprimir / PDF.' },
    en: { title: 'Player Progress Report', age: 'Age', days: 'Training days', sessions: 'Sessions', first: 'First', latest: 'Latest', best: 'Best',
          gain: 'First → best', notYet: 'Not trained yet.', one: 'One session so far — the chart starts with the second.',
          foot: 'Scores are points earned in each station; a longer or faster chain scores more. Generated ',
          print: '🖨 Print / Save PDF', share: '📤 Share', making: 'Preparing…', saved: 'Picture saved — share it from your photos or downloads.', fail: 'Could not share — use Print / Save PDF.' }
  };
  var LANG = (function(){ try { return localStorage.getItem('rp-lang') === 'en' ? 'en' : 'es' } catch(e){ return 'es' } })();
  function tx(k){ return TX[LANG][k] }
  function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
  function gradeLabel(g){
    if (!g) return '';
    if (LANG === 'es'){ if (g === 'K') return 'Kínder'; if (g === 'College') return 'Universidad'; var e = +g; if (!e) return String(g);
      return e + ({1:'ro',2:'do',3:'ro',4:'to',5:'to',6:'to',7:'mo',8:'vo',9:'no',10:'mo',11:'mo',12:'mo'}[e] || '') + ' grado' }
    if (g === 'K') return 'Kindergarten'; if (g === 'College') return 'College'; var n = +g; if (!n) return String(g); return n + (n===1?'st':n===2?'nd':n===3?'rd':'th') + ' grade' }
  function dstr(at, long){ var d = new Date(at); if (isNaN(d)) return '—'; return d.toLocaleDateString(LANG === 'es' ? 'es-PR' : 'en-US', long ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }) }
  function dayKey(at){ var d = new Date(at); return isNaN(d) ? '' : d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() }

  function chart(pts){
    if (pts.length < 2) return '<div class="rp-one">' + tx('one') + '</div>';
    var v = pts.map(function(p){ return p.v }), mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), top = v.indexOf(mx);
    var pad = Math.max(1, Math.round((mx - mn) * .15)), lo = Math.max(0, mn - pad), hi = Math.max(mx + pad, lo + 4);
    var W = 520, H = 150, L = 40, R = 12, T = 12, B = 24;
    var X = function(i){ return L + (W - L - R) * i / (pts.length - 1) }, Y = function(x){ return T + (H - T - B) * (hi - x) / (hi - lo) };
    var g = Math.max(1, Math.ceil((hi - lo) / 4)), s = '<svg class="rp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Score by session">';
    for (var y = lo; y <= hi; y += g) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(y) + '" y2="' + Y(y) + '" class="rp-grid"/><text x="' + (L - 6) + '" y="' + (Y(y) + 4) + '" class="rp-ax" text-anchor="end">' + y + '</text>';
    s += '<polyline class="rp-line" points="' + pts.map(function(p, i){ return X(i).toFixed(1) + ',' + Y(p.v).toFixed(1) }).join(' ') + '"/>';
    pts.forEach(function(p, i){ s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (i === top ? 5.5 : 3.2) + '" class="' + (i === top ? 'rp-best' : 'rp-pt') + '"/>' });
    s += '<text x="' + L + '" y="' + (H - 6) + '" class="rp-ax">' + dstr(pts[0].at) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" class="rp-ax" text-anchor="end">' + dstr(pts[pts.length - 1].at) + '</text>';
    return s + '</svg>';
  }

  /* d = the data hooporia_coach / hooporia_my_report give back; name = whose report */
  function build(d, name){
    var k = String(name || '').trim().toLowerCase(), me = { name: name, age: null, grade: '', at: '' }, runs = [];
    (d.players || []).forEach(function(p){ if (String(p.name).trim().toLowerCase() === k && (!me.at || p.at >= me.at)){ me.at = p.at; me.name = String(p.name).trim(); if (p.age) me.age = p.age; if (p.grade) me.grade = p.grade } });
    (d.runs || []).forEach(function(r){ if (String(r.name).trim().toLowerCase() === k){ runs.push(r); if (!me.at || r.at >= me.at){ me.at = r.at; if (r.age) me.age = r.age; if (r.grade) me.grade = r.grade } } });
    return { me: me, runs: runs, school: d.school || '' };
  }

  function html(d, name){
    var b = build(d, name), me = b.me, runs = b.runs;
    var days = {}; runs.forEach(function(r){ days[dayKey(r.at)] = 1 });
    var first = runs.length ? runs[0].at : '', last = runs.length ? runs[runs.length - 1].at : '';
    var head = '<div class="rp-head"><div class="rp-brand">COGNITIVO GYM · HOOPORIA MOBI</div><div class="rp-title">' + tx('title') + '</div></div>'
      + '<div class="rp-who"><div class="rp-name">' + esc(me.name) + '</div><div class="rp-meta">'
      + [me.age ? tx('age') + ' ' + esc(me.age) : '', esc(gradeLabel(me.grade)), esc(b.school)].filter(Boolean).join(' · ') + '</div></div>'
      + '<div class="rp-sum"><div><b>' + Object.keys(days).filter(Boolean).length + '</b><i>' + tx('days') + '</i></div><div><b>' + runs.length + '</b><i>' + tx('sessions') + '</i></div>'
      + '<div><b>' + (first ? dstr(first) : '—') + '</b><i>' + tx('first') + '</i></div><div><b>' + (last ? dstr(last) : '—') + '</b><i>' + tx('latest') + '</i></div></div>';
    var body = GAMES.map(function(g){
      var a = runs.filter(function(r){ return r.game === g.k }).map(function(r){ return { v: +r.score || 0, at: r.at } });
      if (!a.length) return '<div class="rp-game"><div class="rp-gname">' + g.n + '</div><div class="rp-gdesc">' + g.d[LANG] + '</div><div class="rp-one">' + tx('notYet') + '</div></div>';
      var f = a[0].v, l = a[a.length - 1].v, best = Math.max.apply(null, a.map(function(x){ return x.v }));
      var gain = f > 0 ? Math.round((best - f) / f * 100) : null;
      return '<div class="rp-game"><div class="rp-gname">' + g.n + '</div><div class="rp-gdesc">' + g.d[LANG] + '</div>'
        + '<div class="rp-stats"><div><b>' + f + '</b><i>' + tx('first') + '</i></div><div><b>' + l + '</b><i>' + tx('latest') + '</i></div><div><b>' + best + '</b><i>' + tx('best') + '</i></div>'
        + '<div><b>' + (gain == null ? (best > 0 ? '+' + best : '—') : (gain >= 0 ? '+' : '') + gain + '%') + '</b><i>' + tx('gain') + '</i></div><div><b>' + a.length + '</b><i>' + tx('sessions') + '</i></div></div>'
        + chart(a.slice(-40)) + '</div>';
    }).join('');
    var foot = '<div class="rp-foot">' + tx('foot') + dstr(new Date().toISOString(), true) + '.</div>';
    return '<div class="rp">' + head + '<div class="rp-games">' + body + '</div>' + foot + '</div>';
  }

  var CSS = ''
    + '.rp{max-width:760px;margin:0 auto;background:#fff;color:#111;border-radius:14px;padding:24px 22px;font-family:Arial,Helvetica,sans-serif;text-align:left}'
    + '.rp-head{border-bottom:3px solid #111;padding-bottom:10px;margin-bottom:14px}'
    + '.rp-brand{font-size:.68rem;font-weight:900;letter-spacing:.16em;color:#b8860b}'
    + '.rp-title{font-size:1.5rem;font-weight:900;letter-spacing:.02em;margin-top:2px}'
    + '.rp-name{font-size:1.7rem;font-weight:900}.rp-meta{font-size:.95rem;color:#444;margin-top:2px}'
    + '.rp-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 16px}'
    + '.rp-sum div,.rp-stats div{background:#f3f4f6;border-radius:10px;padding:8px 6px;text-align:center}'
    + '.rp-sum b{display:block;font-size:1.15rem}.rp-stats b{display:block;font-size:1.05rem}'
    + '.rp-sum i,.rp-stats i{font-style:normal;font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:#555}'
    + '.rp-games{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '.rp-game{border:1px solid #d9dce1;border-radius:12px;padding:12px;break-inside:avoid}'
    + '.rp-gname{font-weight:900;font-size:1rem}.rp-gdesc{font-size:.74rem;color:#555;margin:2px 0 8px;line-height:1.3}'
    + '.rp-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:6px}'
    + '.rp-chart{width:100%;height:auto;display:block}.rp-grid{stroke:#e5e7eb}.rp-ax{fill:#666;font-size:11px}'
    + '.rp-line{fill:none;stroke:#6d28d9;stroke-width:2.5;stroke-linejoin:round}.rp-pt{fill:#6d28d9}.rp-best{fill:#d4a017;stroke:#111;stroke-width:1}'
    + '.rp-one{font-size:.8rem;color:#666;padding:6px 0}'
    + '.rp-foot{font-size:.7rem;color:#666;margin-top:14px;border-top:1px solid #e5e7eb;padding-top:8px}'
    + '@media (max-width:620px){.rp{padding:18px 14px}.rp-games{grid-template-columns:1fr}.rp-sum{grid-template-columns:repeat(2,1fr)}}'
    + '@media print{@page{margin:12mm}body *{visibility:hidden}.rp,.rp *{visibility:visible}.rp{position:absolute;left:0;top:0;width:100%;max-width:none;border-radius:0;padding:0}'
    + '.rp-games{grid-template-columns:1fr 1fr}.rp-sum{grid-template-columns:repeat(4,1fr)}.rp-sum div,.rp-stats div{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

  /* ── the bar over the report: ES | EN, Print / PDF, Share ── */
  var BAR_CSS = '.rp-bar{max-width:760px;margin:0 auto 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}'
    + '.rp-lang{display:inline-flex;border:2px solid rgba(255,255,255,.25);border-radius:999px;overflow:hidden}'
    + '.rp-lang button{border:0;background:transparent;color:#a7adba;font:900 .8rem Arial,sans-serif;letter-spacing:.08em;padding:9px 14px;cursor:pointer}'
    + '.rp-lang button.on{background:#FFD700;color:#111}'
    + '.rp-acts{display:inline-flex;gap:8px;flex-wrap:wrap}'
    + '.rp-btn{padding:9px 14px;border:2px solid #FFD700;background:rgba(0,0,0,.5);color:#FFD700;font:900 .78rem Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;cursor:pointer;touch-action:manipulation}'
    + '.rp-note{width:100%;font-size:.8rem;color:#a7adba;text-align:right;min-height:1em}'
    + '@media print{.rp-bar{display:none !important}}';
  function picture(el){
    return (window.html2canvas ? Promise.resolve() : new Promise(function(ok, no){
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = ok; s.onerror = no; document.head.appendChild(s);
    })).then(function(){ return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }) })
      .then(function(cv){ return new Promise(function(ok){ cv.toBlob(ok, 'image/png') }) });
  }
  function share(box, name, note){
    var el = box.querySelector('.rp'), title = tx('title') + ' — ' + name;
    note.textContent = tx('making');
    var file = 'progress-' + String(name).replace(/[^A-Za-z0-9]+/g, '-') + '.png';
    picture(el).then(function(blob){
      var f = new File([blob], file, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })){
        return navigator.share({ files: [f], title: title, text: title }).then(function(){ note.textContent = '' }, function(e){ note.textContent = e && e.name === 'AbortError' ? '' : tx('fail') });
      }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); a.remove();
      note.textContent = tx('saved');
    }).catch(function(){ note.textContent = tx('fail') });
  }
  /* draws the bar and the report into box; the language switch redraws it in place */
  function mount(box, d, name){
    if (!document.getElementById('rp-bar-css')){ var s = document.createElement('style'); s.id = 'rp-bar-css'; s.textContent = BAR_CSS; document.head.appendChild(s) }
    HM_REPORT.css();
    box.innerHTML = '<div class="rp-bar"><div class="rp-lang"><button type="button" data-l="es"' + (LANG === 'es' ? ' class="on"' : '') + '>ES</button><button type="button" data-l="en"' + (LANG === 'en' ? ' class="on"' : '') + '>EN</button></div>'
      + '<div class="rp-acts"><button class="rp-btn" type="button" data-a="share">' + tx('share') + '</button><button class="rp-btn" type="button" data-a="print">' + tx('print') + '</button></div><div class="rp-note"></div></div>'
      + html(d, name);
    var note = box.querySelector('.rp-note');
    box.querySelectorAll('.rp-lang button').forEach(function(b){ b.onclick = function(){ LANG = b.getAttribute('data-l'); try { localStorage.setItem('rp-lang', LANG) } catch(e){} mount(box, d, name) } });
    box.querySelector('[data-a="print"]').onclick = function(){ window.print() };
    box.querySelector('[data-a="share"]').onclick = function(){ share(box, name, note) };
  }

  window.HM_REPORT = {
    mount: mount,
    html: html,
    css: function(){ if (!document.getElementById('rp-css')){ var s = document.createElement('style'); s.id = 'rp-css'; s.textContent = CSS; document.head.appendChild(s) } }
  };
})();
