/* Institutional glue for the hooporia.mobi games (Ritnome desk launch).
   Does nothing unless the page decided institutional mode (window.RITNOME_INST, from the launch code in the URL).
   Then: loads the institutional script, sends every "← Home" to the desk, and reports each finished game through the
   desk session — never to the gym server or the athlete database (gymAnotar and jugador-hm.js are off in this mode). */
(function(){
  if (!window.RITNOME_INST) return;
  var s = document.createElement('script'); s.src = 'https://institutional.ritnome.com/ritnome-institutional.js'; s.defer = true; document.head.appendChild(s);
  var games = 0, taps = 0, best = 0, R = null;
  document.addEventListener('pointerup', function(){ taps++ }, true);
  function finished(level){ games++; if (level > best) best = level; if (R) R.checkpoint({}); }
  // fin-hm.js end screen: count the game and point "← Home" at the desk
  if (window.HM_FIN && typeof HM_FIN.show === 'function') {
    var show = HM_FIN.show;
    HM_FIN.show = function(o){ finished(parseInt(o && o.level, 10) || 0); var r = show.apply(this, arguments);
      document.querySelectorAll('#hm-fin a[href="fortress-mobile-hub.html"]').forEach(function(a){ a.href = 'https://institutional.ritnome.com/desk' }); return r; };
  }
  // pages without fin-hm: the game's own end screen
  var end = document.getElementById('screen-end');
  if (end && !window.HM_FIN) new MutationObserver(function(){ if (end.classList.contains('show')) finished(parseInt((document.getElementById('endNum') || {}).textContent, 10) || 0) }).observe(end, { attributes: true, attributeFilter: ['class'] });
  // The Fortress: the win/lose screen; The Reset: the "done" screen (no score — one routine run counts as one game)
  var fc = document.getElementById('challengeComplete');
  if (fc) new MutationObserver(function(){ if (fc.classList.contains('show')) finished(0) }).observe(fc, { attributes: true, attributeFilter: ['class'] });
  var rd = document.getElementById('s-done');
  if (rd) new MutationObserver(function(){ if (rd.classList.contains('on')) finished(0) }).observe(rd, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('a[href="fortress-mobile-hub.html"], a[href="index.html"]').forEach(function(a){ a.href = 'https://institutional.ritnome.com/desk' });
  document.addEventListener('ritnome:ready', function(){
    R = window.RitnomeInstitutional; if (!R || R.mode !== 'active') { R = null; return; }
    R.collect = function(){ return { games_completed: games, interactions: taps, levels: best }; };
    R.start({ mode: 'individual' });
  });
})();
