/* ══════════════════════════════════════════════════════════════════
   HOOPORIA MOBI — WHO IS TRAINING (name, age, grade)

   After signing in with the access code, a player fills in his first
   name (last name or initial optional), his age and his grade, once,
   before he trains. It is kept on this device ("hooporia-player") and
   sent to the coach's board; every score he makes in the four games is
   then saved with it (see gymNombrado in each game's GYM block).

   Signing in again on the same device asks "Is this you?" — so a
   second player on a shared tablet never trains under someone else's
   name. "Change" on the hub does the same at any time.

   The info only ever goes OUT: the public key can add rows to
   hooporia_mobi_players / hooporia_mobi_runs but can never read them.
   Coaches read them in Coach View with a Coach code.
   ══════════════════════════════════════════════════════════════════ */
(function(){
  var SB = 'https://sdaphocueugzfvjovuxd.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYXBob2N1ZXVnemZ2am92dXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MjQyMDgsImV4cCI6MjA5OTIwMDIwOH0.pDAzf4P6dD9eNEBlnP95SdF5BI-R84-Rdc0vKzYcn7M';
  var LS = 'hooporia-player';
  var GRADES = ['K','1','2','3','4','5','6','7','8','9','10','11','12','College'];

  function get(k, s){ try { return (s ? sessionStorage : localStorage).getItem(k) } catch(e){ return null } }
  function set(k, v, s){ try { (s ? sessionStorage : localStorage).setItem(k, v) } catch(e){} }
  function del(k, s){ try { (s ? sessionStorage : localStorage).removeItem(k) } catch(e){} }
  function school(){ return get('rct-mobile-school') || '' }
  function device(){
    var id = get('gostar-device-id');
    if (!id){ id = 'd-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); set('gostar-device-id', id) }
    return id;
  }
  function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
  function gradeLabel(g){
    if (!g) return '';
    if (g === 'K') return 'Kinder';
    if (g === 'College') return 'College';
    var n = +g, s = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return n + s + ' grade';
  }

  var HM = window.HM_PLAYER = {
    /* the player on this device, for this school — or null */
    get: function(){
      try {
        var p = JSON.parse(get(LS) || 'null');
        return p && p.name && (p.school || '') === school() ? p : null;
      } catch(e){ return null }
    },
    gradeLabel: gradeLabel,
    line: function(p){ return p ? p.name + ' · ' + p.age + ' yrs · ' + gradeLabel(p.grade) : '' },

    /* a score, saved with the player's info. Fire and forget: it never holds up a game. */
    score: function(game, points){
      var p = HM.get(); if (!p) return;
      try {
        fetch(SB + '/rest/v1/hooporia_mobi_runs', {
          method: 'POST', keepalive: true,
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ game: game, score: points, player_name: p.name, player_age: p.age, player_grade: p.grade,
                                 school_name: p.school || null, device: device(), player_key: HM.key(p) })
        }).catch(function(){});
      } catch(e){}
    },

    /* The hub: ask, or confirm after a fresh sign-in. done() runs once someone is set. */
    ensure: function(done){
      var p = HM.get(), fresh = get('hm-fresh-login', true) === '1';
      if (p && !fresh){ done && done(p); return }
      if (p && fresh) confirmBox(p, done); else form(done);
    },
    change: function(done){ form(done) },

    /* The player's private key: made on this device the first time he fills in his
       info, kept with it, and sent with his scores. It is what opens HIS progress
       report (report.html) — nobody else's. */
    key: function(p){
      p = p || HM.get(); if (!p) return null;
      if (!p.key){ p.key = newKey(); set(LS, JSON.stringify(p)) }
      return p.key;
    }
  };
  function newKey(){
    var a = '';
    try { var b = new Uint8Array(16); crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) a += ('0' + b[i].toString(16)).slice(-2) }
    catch(e){ a = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36) }
    return 'k-' + a;
  }

  /* ── the screens ─────────────────────────────────────────────── */
  var CSS = '#hm-capa{position:fixed;inset:0;z-index:100000;background:rgba(5,5,10,.96);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:28px 16px;font-family:Outfit,Arial,sans-serif;color:#fff}'
    + '#hm-box{width:100%;max-width:420px;margin:auto 0;background:#111118;border:2px solid rgba(255,215,0,.45);border-radius:18px;padding:22px 18px;box-shadow:0 0 40px rgba(255,215,0,.15)}'
    + '#hm-box h2{font-family:"Bebas Neue",Arial,sans-serif;font-size:2rem;letter-spacing:.06em;text-align:center;color:#FFD700;line-height:1}'
    + '#hm-box .sub{font-size:.85rem;color:#a7adba;text-align:center;margin:6px 0 16px;line-height:1.4}'
    + '#hm-box label{display:block;font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#c8ccd4;margin:12px 0 5px}'
    + '#hm-box label small{font-weight:600;letter-spacing:.04em;text-transform:none;color:#7d8696}'
    + '#hm-box input,#hm-box select{width:100%;padding:13px 12px;border-radius:12px;border:2px solid rgba(255,255,255,.18);background:#0a0a0f;color:#fff;font:700 1.05rem Outfit,Arial,sans-serif;-webkit-user-select:text;user-select:text}'
    + '#hm-box input:focus,#hm-box select:focus{outline:none;border-color:#FFD700}'
    + '#hm-box .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '#hm-box .go{display:block;width:100%;margin-top:18px;padding:15px;border:0;border-radius:12px;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#1a0f0f;font:900 1.05rem Outfit,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;touch-action:manipulation}'
    + '#hm-box .alt{display:block;width:100%;margin-top:10px;padding:13px;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:transparent;color:#fff;font:800 .95rem Outfit,Arial,sans-serif;cursor:pointer;touch-action:manipulation}'
    + '#hm-box .who{font-size:1.5rem;font-weight:900;text-align:center;margin:6px 0 2px}'
    + '#hm-box .whoi{font-size:.95rem;color:#c8ccd4;text-align:center}'
    + '#hm-err{min-height:1.2em;color:#ff8888;font-size:.85rem;text-align:center;margin-top:10px}'
    + '#hm-box .coach{display:block;text-align:center;margin-top:12px;padding:9px;border-radius:999px;border:1px solid rgba(255,255,255,.18);color:#a7adba;font:800 .82rem Outfit,Arial,sans-serif;text-decoration:none}';

  function capa(html){
    var old = document.getElementById('hm-capa'); if (old) old.remove();
    if (!document.getElementById('hm-css')){ var st = document.createElement('style'); st.id = 'hm-css'; st.textContent = CSS; document.head.appendChild(st) }
    var c = document.createElement('div'); c.id = 'hm-capa';
    c.innerHTML = '<div id="hm-box">' + html + '</div>';
    document.body.appendChild(c);
    return c;
  }
  function close(){ var c = document.getElementById('hm-capa'); if (c) c.remove(); del('hm-fresh-login', true) }

  function confirmBox(p, done){
    var c = capa('<h2>IS THIS YOU?</h2><div class="sub">¿Eres tú?</div>'
      + '<div class="who">' + esc(p.name) + '</div><div class="whoi">' + esc(p.age) + ' yrs · ' + esc(gradeLabel(p.grade)) + '</div>'
      + '<button class="go" id="hm-yes" type="button">Yes, that’s me · Sí, soy yo</button>'
      + '<button class="alt" id="hm-no" type="button">No — new player · Jugador nuevo</button>');
    c.querySelector('#hm-yes').onclick = function(){ close(); done && done(p) };
    c.querySelector('#hm-no').onclick = function(){ form(done) };
  }

  function form(done){
    var p = HM.get() || {};
    var ages = '<option value="">—</option>'; for (var a = 5; a <= 25; a++) ages += '<option value="' + a + '">' + a + '</option>';
    var grades = '<option value="">—</option>' + GRADES.map(function(g){ return '<option value="' + g + '">' + gradeLabel(g) + '</option>' }).join('');
    var c = capa('<h2>WHO’S TRAINING?</h2><div class="sub">Fill this in before you start · Llénalo antes de empezar</div>'
      + '<label for="hm-n">First name · Nombre</label><input id="hm-n" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false">'
      + '<label for="hm-a">Last name or initial · Apellido o inicial <small>(optional · opcional)</small></label><input id="hm-a" maxlength="18" autocomplete="off" autocapitalize="words" spellcheck="false">'
      + '<div class="two"><div><label for="hm-e">Age · Edad</label><select id="hm-e">' + ages + '</select></div>'
      + '<div><label for="hm-g">Grade · Grado</label><select id="hm-g">' + grades + '</select></div></div>'
      + '<button class="go" id="hm-ok" type="button">Start training · A entrenar</button><div id="hm-err"></div>'
      + '<a class="coach" href="coach.html">🧑‍🏫 ¿Coach? Coach View →</a>');
    var w = String(p.name || '').split(' ');
    c.querySelector('#hm-n').value = p.name ? w[0] : '';
    c.querySelector('#hm-a').value = p.name ? w.slice(1).join(' ') : '';
    if (p.age) c.querySelector('#hm-e').value = String(p.age);
    if (p.grade) c.querySelector('#hm-g').value = p.grade;
    setTimeout(function(){ try { c.querySelector('#hm-n').focus() } catch(e){} }, 50);
    c.querySelector('#hm-ok').onclick = function(){
      var clean = function(x){ return String(x || '').trim().replace(/\s+/g, ' ') };
      var n = clean(c.querySelector('#hm-n').value), l = clean(c.querySelector('#hm-a').value);
      var age = parseInt(c.querySelector('#hm-e').value, 10), g = c.querySelector('#hm-g').value;
      var err = c.querySelector('#hm-err');
      if (!n){ err.textContent = 'Type your first name · Escribe tu nombre'; return }
      if (!(age >= 5)){ err.textContent = 'Pick your age · Escoge tu edad'; return }
      if (!g){ err.textContent = 'Pick your grade · Escoge tu grado'; return }
      var cap = function(s){ return s.split(' ').map(function(x){ return x.charAt(0).toUpperCase() + x.slice(1) }).join(' ') };
      var name = (cap(n.split(' ')[0]) + (l ? ' ' + cap(l) : '')).slice(0, 40);
      var prev = HM.get();
      var me = { name: name, age: age, grade: g, school: school(),
                 key: prev && prev.key && prev.name.toLowerCase() === name.toLowerCase() ? prev.key : newKey() };
      set(LS, JSON.stringify(me));
      try {
        fetch(SB + '/rest/v1/hooporia_mobi_players', {
          method: 'POST', keepalive: true,
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ player_name: me.name, player_age: me.age, player_grade: me.grade, school_name: me.school || null, device: device(), player_key: me.key })
        }).catch(function(){});
      } catch(e){}
      close(); done && done(me);
    };
  }
})();
