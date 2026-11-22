/* ══════════════════════════════════════════════════════════════════
   HOOPORIA MOBI — THE END-OF-GAME SCREEN, THE FORTRESS WAY

   The Fortress ends a game with a message over the court — ¡BUEN
   INTENTO! / ¡GRAN TRABAJO! / ¡MEMORIA DE ORO! — the level and time
   under it, ¡OTRA VEZ!, ← Inicio and ← Atrás, and a burst of confetti.
   Recall, Recognition and Replay end the same way through this file,
   so all four stations finish alike.

   HM_FIN.show({ level, stats, again, back })
     level  the longest chain — it picks the message (8+ great, 15+ gold,
            the same marks as The Fortress)
     stats  the line under the message
     again  what ¡OTRA VEZ! does (the game's own play-again)
     back   where ← Atrás goes (the game's own start screen)
   ══════════════════════════════════════════════════════════════════ */
(function(){
  function en(){ try { return localStorage.getItem('ft-lang') === 'en' } catch(e){ return false } }
  var TX = {
    es: { gold: '¡MEMORIA DE ORO! 🧠', great: '¡GRAN TRABAJO! 🔥', good: '¡BUEN INTENTO! 💪', again: '¡OTRA VEZ!', home: '← Inicio', back: '← Atrás' },
    en: { gold: 'GOLDEN MEMORY! 🧠', great: 'GREAT JOB! 🔥', good: 'GOOD TRY! 💪', again: 'TRY AGAIN!', home: '← Home', back: '← Back' }
  };
  var CSS = ''
    + '#hm-fin{position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;justify-content:center;align-items:center;flex-direction:column;gap:16px;z-index:1000;padding:20px;text-align:center}'
    + '#hm-fin .r{font-family:"Bebas Neue",sans-serif;font-size:min(40px,9.6vw);letter-spacing:3px;line-height:1.1}#hm-fin .r b{font-weight:inherit;white-space:nowrap}'
    + '#hm-fin .r.win{color:#FFD700;text-shadow:0 0 30px #FFD700}#hm-fin .r.lose{color:#FF6B35;text-shadow:0 0 20px #FF6B35}'
    + '#hm-fin .s{font-family:"Bebas Neue",sans-serif;font-size:1.1rem;color:#FFF8E7;letter-spacing:2px}'
    + '#hm-fin .a{padding:14px 36px;border:none;border-radius:30px;font-family:"Bebas Neue",sans-serif;font-size:1.1rem;letter-spacing:2px;cursor:pointer;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#1a0f0f;box-shadow:0 4px 16px rgba(255,215,0,.35);touch-action:manipulation}'
    + '#hm-fin .row{display:flex;gap:12px;margin-top:2px}'
    + '#hm-fin .row a{border:1px solid rgba(255,255,255,.15);border-radius:100px;padding:10px 18px;color:rgba(255,255,255,.75);font:700 .8rem Arial,sans-serif;text-decoration:none;letter-spacing:.04em}'
    + '.hm-conf{position:fixed;top:-12px;width:9px;height:14px;z-index:1001;pointer-events:none;animation:hmConf 2.6s ease-in forwards}'
    + '@keyframes hmConf{to{transform:translateY(110vh) rotate(720deg);opacity:.6}}'
    + '@media (min-width:900px) and (min-height:560px){#hm-fin .r{font-size:3.6rem}#hm-fin .s{font-size:1.5rem}#hm-fin .a{font-size:1.5rem;padding:18px 48px}#hm-fin .row a{font-size:1rem;padding:12px 22px}}';

  function confetti(){
    var c = ['#FFD700','#FF6B35','#FF1493','#00D9D9','#FF8C42','#32CD32'];
    for (var i = 0; i < 40; i++){
      var d = document.createElement('div'); d.className = 'hm-conf';
      d.style.left = Math.random() * 100 + 'vw'; d.style.background = c[i % c.length];
      d.style.animationDelay = (Math.random() * .6) + 's'; d.style.borderRadius = Math.random() < .5 ? '50%' : '2px';
      document.body.appendChild(d);
      (function(x){ setTimeout(function(){ if (x.parentNode) x.parentNode.removeChild(x) }, 3400) })(d);
    }
  }

  window.HM_FIN = {
    show: function(o){
      var t = TX[en() ? 'en' : 'es'], lv = +o.level || 0;
      if (!document.getElementById('hm-fin-css')){ var s = document.createElement('style'); s.id = 'hm-fin-css'; s.textContent = CSS; document.head.appendChild(s) }
      HM_FIN.hide();
      var f = document.createElement('div'); f.id = 'hm-fin';
      var msg = (lv >= 15 ? t.gold : lv >= 8 ? t.great : t.good), sp = msg.lastIndexOf(' ');   // the words on one line, the emoji under them
      f.innerHTML = '<div class="r ' + (lv >= 8 ? 'win' : 'lose') + '"><b>' + msg.slice(0, sp) + '</b><br>' + msg.slice(sp + 1) + '</div>'
        + '<div class="s"></div><button class="a" type="button">' + t.again + '</button>'
        + '<div class="row"><a href="fortress-mobile-hub.html">' + t.home + '</a><a href="#" class="b">' + t.back + '</a></div>';
      f.querySelector('.s').textContent = o.stats || '';
      f.querySelector('.a').onclick = function(){ HM_FIN.hide(); o.again && o.again() };
      f.querySelector('.b').onclick = function(e){ e.preventDefault(); location.href = o.back || location.pathname.split('/').pop() };
      document.body.appendChild(f);
      confetti();
    },
    hide: function(){ var f = document.getElementById('hm-fin'); if (f) f.parentNode.removeChild(f) },
    en: en
  };
})();
