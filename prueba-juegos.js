// ══════════════════════════════════════════════════════════════════
//  THE GAMES' WIRING TO THE GYM
//
//  Run with `node prueba-juegos.js`. Neither the gym server nor a
//  played round is needed: the server's replies are faked, and the
//  block is exercised by calling gymAnotar() the way the game calls
//  it when a run ends.
//
//  WHY THE BLOCK IS LIFTED OUT OF THE FILE INSTEAD OF BEING CALLED
//  INSIDE IT: each game's whole script lives in an IIFE, so nothing
//  in it is reachable from outside — which is right for the game and
//  awkward for a test. So the block is read out of each file as text
//  and run in a blank page with a stub WARM, which has one real
//  advantage over poking at the page: it checks the actual bytes
//  shipped in that file, including the station number, and the
//  station number is the thing that would silently send a Replay
//  score in under Recall's name.
//
//  What is measured:
//
//    1  that each file posts under ITS OWN game name
//    2  that a player ends up with ONE code and not several
//    3  that the team rides in on the coach's link
//    4  that a server that is down cannot break a game
//    5  that the score is posted from both ends — the warm-up station
//       and the standalone run — and never twice from one
// ══════════════════════════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const AQUI = __dirname;
const EJECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const JUEGOS = [
  ['002-recall.html', 'recall'],
  ['003-recognition.html', 'recognition'],
  ['004-replay.html', 'replay'],
  ['001-fortress.html', 'fortress']
];

let fallos = 0;
const ok  = (t) => console.log('  ok   ' + t);
const mal = (t) => { fallos++; console.log('  BAD  ' + t) };
const si  = (c, t) => c ? ok(t) : mal(t);
const eq  = (a, b, t) => JSON.stringify(a) === JSON.stringify(b)
  ? ok(t)
  : mal(t + ' → expected ' + JSON.stringify(b) + ' and got ' + JSON.stringify(a));

/* The block and the station, straight out of the shipped file. */
function sacarBloque(fichero){
  const s = fs.readFileSync(path.join(AQUI, fichero), 'utf8');
  const i = s.indexOf('//  THE GYM BLOCK');
  const j = s.indexOf('/* ?warm=1 starts a warm-up');
  const m = /STATION:\s*(\d)/.exec(s);
  return { texto: s.slice(i, j), estacion: m ? parseInt(m[1], 10) : 0, fuente: s };
}

const sitio = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>t</title>');
});

(async () => {
const PUERTO = await new Promise((r) => sitio.listen(0, () => r(sitio.address().port)));
const navegador = await chromium.launch({ executablePath: EJECUTABLE });

async function montar(fichero, busqueda, caido){
  const { texto, estacion } = sacarBloque(fichero);
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const llamadas = [];
  pag.on('pageerror', (e) => mal(fichero + ' threw: ' + e.message));
  await pag.route('**/cognitivo-gym-server.onrender.com/**', (ruta) => {
    const u = ruta.request().url();
    let cuerpo = null;
    try { cuerpo = JSON.parse(ruta.request().postData() || '{}') } catch(e){}
    llamadas.push({ ruta: u.replace(/^.*onrender\.com/, ''), cuerpo });
    if (caido) return ruta.abort();
    if (/\/jugador/.test(u)){
      return ruta.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, codigo: 'ACD-EFG', equipo: cuerpo && cuerpo.equipo }) });
    }
    return ruta.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, mejor: 21, nivel: 6, record: true }) });
  });

  await pag.goto('http://localhost:' + PUERTO + '/' + (busqueda || ''));
  /* The stub WARM carries only what the block reads: the station
     number out of the real file, and the on/off flag. */
  await pag.evaluate(([t, n]) => {
    window.WARM = { STATION: n, on: false };
    const e = document.createElement('script');
    e.textContent = t;
    document.body.appendChild(e);
  }, [texto, estacion]);
  return { ctx, pag, llamadas, estacion };
}

console.log('\n1 · Each file posts under its own game name\n');
for (const [fichero, juego] of JUEGOS){
  const { ctx, pag, llamadas, estacion } = await montar(fichero);
  si(estacion >= 1 && estacion <= 4, fichero + ': station ' + estacion);
  await pag.evaluate(() => gymAnotar(21));
  await pag.waitForTimeout(400);

  const jugador = llamadas.filter((l) => /\/jugador/.test(l.ruta));
  const anotar  = llamadas.filter((l) => /\/anotar/.test(l.ruta));
  eq(jugador.length, 1, fichero + ': asks for a code, once');
  eq(anotar.length, 1, fichero + ': and posts one score');
  eq(anotar[0] && anotar[0].cuerpo.juego, juego, fichero + ': under the name "' + juego + '"');
  eq(anotar[0] && anotar[0].cuerpo.puntos, 21, fichero + ': with the points it was given');
  eq(anotar[0] && anotar[0].cuerpo.codigo, 'ACD-EFG', fichero + ': and the code it was issued');
  await ctx.close();
}

console.log('\n2 · One code, however many scores\n');
{
  const { ctx, pag, llamadas } = await montar('002-recall.html');
  await pag.evaluate(() => gymAnotar(21));
  await pag.waitForTimeout(300);
  await pag.evaluate(() => gymAnotar(36));
  await pag.waitForTimeout(300);
  eq(llamadas.filter((l) => /\/jugador/.test(l.ruta)).length, 1,
     'a second score does not ask for a second code');
  eq(llamadas.filter((l) => /\/anotar/.test(l.ruta)).length, 2, 'but both scores are posted');
  eq(await pag.evaluate(() => localStorage.getItem('cg-codigo')), 'ACD-EFG',
     'and the code is kept on the phone');
  await ctx.close();
}

console.log('\n3 · Three scores at once still make one code\n');
{
  /* THE RACE THAT WOULD SPLIT A PLAYER IN TWO. Calls landing before
     any answer comes back used to mean a code each — and a kid with
     two codes has two halves of his four games and a board that never
     opens. */
  const { ctx, pag, llamadas } = await montar('002-recall.html');
  await pag.evaluate(() => { gymAnotar(10); gymAnotar(21); gymAnotar(36) });
  await pag.waitForTimeout(800);
  eq(llamadas.filter((l) => /\/jugador/.test(l.ruta)).length, 1,
     'three scores fired together ask for exactly one code');
  eq(llamadas.filter((l) => /\/anotar/.test(l.ruta)).length, 3, 'and all three are posted');
  const codigos = llamadas.filter((l) => /\/anotar/.test(l.ruta)).map((l) => l.cuerpo.codigo);
  eq(codigos, ['ACD-EFG', 'ACD-EFG', 'ACD-EFG'], 'all three under the same code');
  await ctx.close();
}

console.log('\n4 · The team rides in on the link\n');
{
  const { ctx, pag, llamadas } = await montar('002-recall.html', '?e=paradiso-6');
  eq(await pag.evaluate(() => localStorage.getItem('cg-equipo')), 'paradiso-6',
     'the team is remembered the moment the link is seen');
  await pag.evaluate(() => gymAnotar(21));
  await pag.waitForTimeout(400);
  const j = llamadas.filter((l) => /\/jugador/.test(l.ruta))[0];
  eq(j && j.cuerpo.equipo, 'paradiso-6', 'and travels with the request for a code');
  await ctx.close();

  /* AND IT OUTLIVES THE LINK. The coach's link may drop a kid into
     one game while his code does not get issued until he finishes a
     different one, three pages later, with no query string left. */
  const b = await montar('004-replay.html');
  await b.pag.evaluate(() => { try { localStorage.setItem('cg-equipo', 'paradiso-6') } catch(e){} });
  await b.pag.evaluate(() => gymAnotar(10));
  await b.pag.waitForTimeout(500);
  const j2 = b.llamadas.filter((l) => /\/jugador/.test(l.ruta))[0];
  eq(j2 && j2.cuerpo.equipo, 'paradiso-6', 'a later game still knows the team, with no link left');
  await b.ctx.close();
}

console.log('\n5 · A server that is down cannot break a game\n');
{
  const { ctx, pag, llamadas } = await montar('002-recall.html', '', true);
  /* pageerror already fails the suite, so an unhandled rejection out
     of the block shows up as a failure above this line. */
  await pag.evaluate(() => gymAnotar(21));
  await pag.waitForTimeout(700);
  si(llamadas.length >= 1, 'it tried');
  eq(await pag.evaluate(() => localStorage.getItem('cg-codigo')), null,
     'no code is invented when the server cannot be reached');
  si(await pag.evaluate(() => typeof gymAnotar === 'function'), 'and nothing fell over');
  await ctx.close();
}

console.log('\n6 · Posted from both ends, and never twice from one\n');
{
  for (const [fichero] of JUEGOS){
    const s = sacarBloque(fichero).fuente;

    si(/warmWrite\(WARM\.STATION, total\);[\s\S]{0,300}gymAnotar\(total\);/.test(s),
       fichero + ': the warm-up station posts its score as it closes');

    si(s.indexOf("if (typeof WARM === 'object' && WARM && !WARM.on) gymAnotar(WARM.hostScore());") !== -1,
       fichero + ': the standalone run posts too, guarded against the warm-up');

    /* Three mentions and no more: the definition, the warm-up close,
       and the standalone end. A fourth call would be a run going in
       twice. (Fortress carries one extra in prose, which is why the
       count is of calls and not of the word.) */
    eq((s.match(/gymAnotar\([a-zA-Z]/g) || []).length, 3,
       fichero + ': three calls — the definition and the two ends');

    si(s.indexOf("NOMBRES: ['recall', 'recognition', 'replay', 'fortress']") !== -1,
       fichero + ': and the game name comes out of WARM.STATION, not a second constant');
  }

  /* BYTE FOR BYTE. The block is copied, not shared, exactly like the
     WARM engine above it — so the only thing holding the four copies
     together is a check that says so out loud. */
  const trozos = JUEGOS.map(([f]) => sacarBloque(f).texto);
  si(trozos.every((t) => t.length > 500 && t === trozos[0]),
     'and the gym block is byte-identical in all four files');

  /* And the four stations are the four stations, one each. */
  const estaciones = JUEGOS.map(([f]) => sacarBloque(f).estacion).sort();
  eq(estaciones, [1, 2, 3, 4], 'the four files hold the four station numbers, one each');
}

await navegador.close();
sitio.close();
console.log('\n' + (fallos === 0
  ? 'OK — the four games feed the board, under one code, and survive a server that is not there'
  : 'FAILED — ' + fallos + ' problem(s)') + '\n');
process.exit(fallos === 0 ? 0 : 1);

})();
