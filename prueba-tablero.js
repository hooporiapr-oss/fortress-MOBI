// ══════════════════════════════════════════════════════════════════
//  THE BOARD'S TESTS
//
//  Run with `node prueba-tablero.js`. The gym server is NOT needed:
//  its replies are faked here, because what is measured on this side
//  is the drawing and the door, not the server — the server has
//  prueba-gym.js.
//
//  The page is served over http and not opened as a file, for two
//  reasons that both bite: localStorage is unreliable on file://, and
//  the server's domain list refuses a "null" origin, which is what a
//  file page sends.
//
//  What is measured:
//
//    1  that the board does not open without the four games
//    2  that the door says which ones are missing
//    3  that one more level is drawn FURTHER OUT, which is the whole
//       idea of the picture
//    4  that the saved image never carries the code
//    5  that a code that does not exist does not trap anybody
// ══════════════════════════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const AQUI = __dirname;
const EJECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let fallos = 0;
const ok  = (t) => console.log('  ok   ' + t);
const mal = (t) => { fallos++; console.log('  BAD  ' + t) };
const si  = (c, t) => c ? ok(t) : mal(t);
const eq  = (a, b, t) => JSON.stringify(a) === JSON.stringify(b)
  ? ok(t)
  : mal(t + ' → expected ' + JSON.stringify(b) + ' and got ' + JSON.stringify(a));

// ── A reply the way the gym server builds one ─────────────────────
const nivel = (p) => p <= 0 ? 0 : Math.round((-1 + Math.sqrt(1 + 8 * p)) / 2);
const CUATRO = ['recall', 'recognition', 'replay', 'fortress'];
const NOMBRES = {
  recall: 'THE RECALL', recognition: 'THE RECOGNITION',
  replay: 'THE REPLAY', fortress: 'THE FORTRESS'
};

/* mios: { juego: puntos | null }. A null means NOT PLAYED, which is
   not the same as played with zero — that difference is the lock. */
function respuesta(mios, equipo, gym){
  const juegos = CUATRO.map((j) => {
    const p = mios[j];
    const delEquipo = (equipo && equipo[j]) || [];
    return {
      juego: j, nombre: NOMBRES[j],
      jugado: p !== null && p !== undefined,
      mio: p || 0, nivelMio: nivel(p || 0),
      equipo: delEquipo, nivelesEquipo: delEquipo.map(nivel),
      mejorGym: (gym && gym[j]) || 0, nivelGym: nivel((gym && gym[j]) || 0)
    };
  });
  const faltan = juegos.filter((j) => !j.jugado).map((j) => j.juego);
  const escala = Math.max(6, ...juegos.map((j) =>
    Math.max(j.nivelGym, j.nivelMio, ...(j.nivelesEquipo.length ? j.nivelesEquipo : [0]))));
  return {
    ok: true, codigo: 'ACD-EFG',
    equipo: { id: 'eq', nombre: 'Paradiso 6th' },
    escala, completo: faltan.length === 0, faltan, juegos
  };
}

// ── A static server for the gym's folder ──────────────────────────
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png' };
const sitio = http.createServer((req, res) => {
  const f = path.join(AQUI, (req.url.split('?')[0] || '/').replace(/^\/+/, '') || 'index.html');
  fs.readFile(f, (e, b) => {
    if (e){ res.statusCode = 404; return res.end('no') }
    res.setHeader('Content-Type', TIPOS[path.extname(f)] || 'text/plain');
    res.end(b);
  });
});

(async () => {
const PUERTO = await new Promise((r) => sitio.listen(0, () => r(sitio.address().port)));
const BASE = 'http://localhost:' + PUERTO + '/tablero-gym.html';
const navegador = await chromium.launch({ executablePath: EJECUTABLE });

/* Every call to the gym server is answered from here. 'guion' is
   what the next /tablero will reply; each test sets it. */
let guion = null;
async function abrir(){
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  pag.on('pageerror', (e) => mal('the page threw: ' + e.message));
  await pag.route('**/cognitivo-gym-server.onrender.com/**', (ruta) => {
    const cuerpo = typeof guion === 'function' ? guion() : guion;
    ruta.fulfill({
      status: (cuerpo && cuerpo.__http) || 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(cuerpo || { ok: false })
    });
  });
  return { ctx, pag };
}
const visible = (pag, sel) => pag.evaluate((s) => {
  const e = document.querySelector(s);
  return !!e && getComputedStyle(e).display !== 'none';
}, sel);

console.log('\n1 · With nothing played, the door and not the board\n');
{
  const { ctx, pag } = await abrir();
  await pag.goto(BASE);
  await pag.waitForTimeout(400);
  si(await visible(pag, '#gate'), 'the door is there');
  si(!(await visible(pag, '#board')), 'and the board is not');
  eq(await pag.locator('#gateTitle').textContent(), 'EARN THE BOARD', 'and it says it is earned');
  eq(await pag.locator('#gateDots .dot').count(), 4, 'with the four pips');
  eq(await pag.locator('#gateDots .dot.done').count(), 0, 'none of them lit');
  /* The door must offer the way out of it, or it is a wall. */
  const href = await pag.locator('#gateWarm').getAttribute('href');
  si(/002-recall\.html\?warm=1/.test(href || ''), 'and the way in is the warm-up: ' + href);
  si(await visible(pag, '#gateHave'), 'and whoever has a code can type it');
  await ctx.close();
}

console.log('\n2 · With two of four, it says which two\n');
{
  guion = respuesta({ recall: 21, fortress: 15 }, null, { recall: 36 });
  const { ctx, pag } = await abrir();
  await pag.goto(BASE);
  await pag.locator('#gateCode').fill('acd-efg');
  await pag.locator('#gateGo').click();
  await pag.waitForTimeout(400);

  si(!(await visible(pag, '#board')), 'the board stays shut');
  eq(await pag.locator('#gateTitle').textContent(), 'ALMOST', 'the door changes its tune');
  const t = await pag.locator('#gateText').textContent();
  si(/2 of 4/.test(t), 'it counts what he has: ' + t.trim());
  si(/RECOGNITION/.test(t) && /REPLAY/.test(t), 'and names the two that are missing');
  eq(await pag.locator('#gateDots .dot.done').count(), 2, 'two pips lit');
  eq(await pag.locator('#gateWarm').textContent(), 'FINISH THE FOUR', 'and the button says so');
  /* With a code in hand he has to be shown it, or he loses the only
     thing that brings his games back. */
  si(await visible(pag, '#gateMyCode'), 'and he is shown his code so he keeps it');
  eq(await pag.locator('#gateMyCodeV').textContent(), 'ACD-EFG', 'which is his');
  await ctx.close();
}

console.log('\n3 · With the four, the board opens\n');
let PAG = null, CTX = null;
{
  guion = respuesta({ recall: 21, recognition: 6, replay: 0, fortress: 36 },
                    { recall: [21, 36, 10], fortress: [36, 15] },
                    { recall: 55, recognition: 28, replay: 10, fortress: 45 });
  const a = await abrir(); CTX = a.ctx; PAG = a.pag;
  await PAG.goto(BASE);
  await PAG.locator('#gateCode').fill('ACD-EFG');
  await PAG.locator('#gateGo').click();
  await PAG.waitForTimeout(500);

  si(await visible(PAG, '#board'), 'the board is there');
  si(!(await visible(PAG, '#gate')), 'and the door is gone');
  /* A zero at one station does not shut it: he played it. */
  ok('and a station played with zero points did not shut it');

  eq(await PAG.locator('#gSectors .sector').count(), 4, 'four quadrants, one per game');
  eq(await PAG.locator('#gLabels text').count(), 4, 'four names');
  eq(await PAG.locator('#rows .row').count(), 4, 'and four rows under it');
  eq(await PAG.locator('#myCode').textContent(), 'ACD-EFG', 'his code is on the page');
  eq(await PAG.locator('#teamName').textContent(), 'Paradiso 6th', 'and his team');
}

console.log('\n4 · One more level is drawn further out\n');
{
  /* THE WHOLE POINT OF THE PICTURE. If this stops being true the
     board still looks fine and means nothing. Fortress (level 8) has
     to sit outside Recall (level 6), which sits outside Recognition
     (level 3). */
  /* The radius is pulled out with a regex and not by splitting on
     spaces: the path is written "M160.00 98.00 A112.10 112.10 …",
     with no space after the M or the A, so the tokens come out as
     "A112.10" and a split never finds a number on its own. The first
     version of this read zeros for all three and still printed a
     comparison, which is the worst kind of passing test. */
  const radios = await PAG.evaluate(() => {
    const out = {};
    document.querySelectorAll('#gMarks .mark-mine').forEach((p) => {
      const m = /A\s*([\d.]+)/.exec(p.getAttribute('d') || '');
      out[p.getAttribute('stroke')] = m ? parseFloat(m[1]) : NaN;
    });
    return out;
  });
  si(Object.keys(radios).length === 3 && Object.values(radios).every((r) => r > 0),
     'the three marks have a real radius each');
  const rRecall = radios['#FFD700'], rRecog = radios['#00D9D9'], rFort = radios['#FF6B35'];
  si(rFort > rRecall && rRecall > rRecog,
     'fortress 8 is outside recall 6 is outside recognition 3 (' +
     [rRecog, rRecall, rFort].map((x) => Math.round(x)).join(' < ') + ')');

  /* And the one played with zero gets no mark at all, rather than a
     mark lying on the floor pretending to be a score. */
  eq(await PAG.locator('#gMarks .mark-mine').count(), 3,
     'and the station with zero points draws no mark of its own');

  /* The gym record is drawn for all four, because it belongs to
     everybody and it is the line to reach. */
  eq(await PAG.locator('#gMarks .mark-gym').count(), 4, 'the gym record is drawn on all four');

  /* The team's ticks: three in recall, two in fortress, and nothing
     where the team has not scored. */
  eq(await PAG.locator('#gMarks .tick-team').count(), 5,
     'and the team ticks are only the ones there are');
}

console.log('\n5 · Tapping a game drills into it\n');
{
  eq(await PAG.locator('#hubKick').textContent(), 'YOUR GYM', 'the middle starts on the whole gym');
  eq(await PAG.locator('#hubNum').textContent(), '17', 'with the four levels added up: 6+3+0+8');

  await PAG.locator('#rows .row').nth(3).click();      // fortress
  await PAG.waitForTimeout(250);
  eq(await PAG.locator('#hubKick').textContent(), 'FORTRESS', 'tapping a row lights that game');
  eq(await PAG.locator('#hubNum').textContent(), '8', 'and the middle shows its level');
  si(/gym record 9/.test(await PAG.locator('#hubSub').textContent()),
     'and the record to beat');

  /* Tapping it again has to let go. A board with something stuck lit
     feels broken. */
  await PAG.locator('#rows .row').nth(3).click();
  await PAG.waitForTimeout(250);
  eq(await PAG.locator('#hubKick').textContent(), 'YOUR GYM', 'tapping it again lets go');
}

console.log('\n6 · The saved image\n');
{
  /* A STATIC CHECK, and on purpose: reading the text out of a PNG is
     not something this suite can do, but what CAN be guaranteed is
     that the function that draws it never reads the code. If somebody
     adds it one day, this fails. */
  const fuente = fs.readFileSync(path.join(AQUI, 'tablero-gym.html'), 'utf8');
  const i = fuente.indexOf('function componerImagen()');
  const j = fuente.indexOf('function nombreArchivo()');
  const cuerpo = fuente.slice(i, j);
  si(i > 0 && j > i, 'the drawing function is where it is expected');
  si(cuerpo.indexOf('codigo') === -1,
     'and it never reads the code: a shared image cannot hand out an identity');
  si(cuerpo.indexOf('DATOS.equipo') !== -1, 'it does carry the team name, which is nobody\'s');

  const descarga = PAG.waitForEvent('download', { timeout: 15000 });
  await PAG.locator('#btnSave').click();
  const d = await descarga;
  si(/^cognitivo-gym-\d{8}\.png$/.test(d.suggestedFilename()),
     'saving gives a dated png: ' + d.suggestedFilename());
  const destino = path.join(require('os').tmpdir(), 'tablero-prueba.png');
  await d.saveAs(destino);
  const tam = fs.statSync(destino).size;
  si(tam > 8000, 'and it has something drawn in it (' + Math.round(tam / 1024) + ' KB)');
  /* The PNG signature, so a file that is not an image cannot pass. */
  const cabecera = fs.readFileSync(destino).slice(0, 8).toString('hex');
  eq(cabecera, '89504e470d0a1a0a', 'and it really is a png');
  fs.unlinkSync(destino);

  /* The share button hides itself where the browser cannot share a
     file, which is the case in this one. A button that does nothing
     is worse than no button. */
  si(!(await visible(PAG, '#btnShare')),
     'and where the browser cannot share a file, that button is not shown');
  await CTX.close();
}

console.log('\n7 · A code that does not exist traps nobody\n');
{
  guion = { ok: false, error: 'codigo-no-existe', __http: 404 };
  const { ctx, pag } = await abrir();
  await pag.goto(BASE);
  await pag.locator('#gateCode').fill('XXX-XXX');
  await pag.locator('#gateGo').click();
  await pag.waitForTimeout(400);
  si(/not in the gym/.test(await pag.locator('#gateAviso').textContent()), 'it says so plainly');
  /* AND IT FORGETS IT. Otherwise a typo locks him out of his own
     page every time he opens it, with an error he cannot act on. */
  const guardado = await pag.evaluate(() => localStorage.getItem('cg-codigo'));
  eq(guardado, null, 'and it does not keep the bad code');
  await ctx.close();
}

console.log('\n8 · Coming back, and coming back on a new phone\n');
{
  guion = respuesta({ recall: 21, recognition: 6, replay: 3, fortress: 36 }, null, {});
  const { ctx, pag } = await abrir();
  await pag.goto(BASE);
  await pag.locator('#gateCode').fill('ACD-EFG');
  await pag.locator('#gateGo').click();
  await pag.waitForTimeout(400);
  si(await visible(pag, '#board'), 'it opens the first time');

  /* Reopening goes straight in: the door is for the first day and
     for a new phone, not for every day. */
  await pag.reload();
  await pag.waitForTimeout(500);
  si(await visible(pag, '#board'), 'and reopening goes straight to the board');
  si(!(await visible(pag, '#gate')), 'without asking again');

  /* A new phone is a context with nothing saved. The code is the
     only thing that carries the board across, which is the whole
     reason it exists. */
  const otro = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pag2 = await otro.newPage();
  await pag2.route('**/cognitivo-gym-server.onrender.com/**', (ruta) => ruta.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(guion)
  }));
  await pag2.goto(BASE);
  await pag2.waitForTimeout(300);
  si(await visible(pag2, '#gate'), 'a new phone starts at the door');
  await pag2.locator('#gateCode').fill('acd efg');
  await pag2.locator('#gateGo').click();
  await pag2.waitForTimeout(400);
  si(await visible(pag2, '#board'), 'and the code typed badly still brings the board over');
  await otro.close();
  await ctx.close();
}

console.log('\n9 · The final scoreboard leads here\n');
{
  const fuente = fs.readFileSync(path.join(AQUI, 'warmup-final.html'), 'utf8');
  si(/href="tablero-gym\.html"/.test(fuente), 'warmup-final.html has the button to the board');
  si(/class="board"/.test(fuente), 'and it is the one that leads, with its own treatment');
  /* It must not try to decide the lock for itself: two locks
     disagreeing is a bug waiting for a slow day. */
  si(fuente.indexOf('cg-codigo') === -1,
     'and it does not judge whether the board is earned — the server does that');
}

await navegador.close();
sitio.close();
console.log('\n' + (fallos === 0
  ? 'OK — the board is earned, it reads from the inside out, and the image carries no identity'
  : 'FAILED — ' + fallos + ' problem(s)') + '\n');
process.exit(fallos === 0 ? 0 : 1);

})();
