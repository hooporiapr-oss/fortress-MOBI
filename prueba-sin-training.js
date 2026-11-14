// Training mode is gone from the four mobile games: not visible, not reachable, Game still starts.
const { chromium } = require('playwright'); const path = require('path');
let bad = 0; const is = (c, m) => { console.log((c ? '  ok   ' : '  BAD  ') + m); if (!c) bad++ };
(async () => { const b = await chromium.launch(); const errs = [];
  for (const f of ['001-fortress.html', '002-recall.html', '003-recognition.html', '004-replay.html']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.route(/^https?:\/\//, (r) => r.abort()); await c.addInitScript(() => { try { localStorage.setItem('rct-mobile-pass', '1'); ['ft-lang','lc-lang','fc-lang'].forEach(function(k){ localStorage.setItem(k, 'en') }) } catch (e) {} }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(f + ': ' + e.message));
    await p.goto('file://' + path.resolve(f)); await p.waitForTimeout(600);
    // walk to the mode screen whatever its entry button is called
    for (const sel of ['#startBtn', '#btnStart', '#playBtn', 'button:has-text("JUGAR")', 'button:has-text("PLAY")', 'button:has-text("EMPEZAR")']) { const l = p.locator(sel).first(); if (await l.count() && await l.isVisible()) { await l.click().catch(() => {}); await p.waitForTimeout(300); break } }
    await p.evaluate(() => { if (typeof showModeScreen === 'function') showModeScreen() }); await p.waitForTimeout(200);
    is(p.url().endsWith(f), f + ': the game itself loaded');
    const t = p.locator('#modeTraining'), lv = p.locator('#levelSection');
    is(await t.count() === 1 && !(await t.isVisible()) && !(await lv.isVisible()), f + ': Training card and level picker are hidden');
    is(await p.evaluate(() => { const e = document.getElementById('modeTraining'); return getComputedStyle(e).display === 'none' }), f + ': Training cannot be tapped (not displayed)');
    const g = p.locator('#modeGame'); is(await g.count() === 1 && !(await g.isVisible()), f + ': the Game card is hidden too (only one mode left)');
    is(!(await p.getByText(/SELECT MODE|SELECCIONA MODO/).first().isVisible().catch(() => false)), f + ': no "Select mode" title');
    is(!(await p.getByText(/^\s*← Back|Back to the gym/).first().isVisible().catch(() => false)) && /PA'LANTE|¡VAMOS|VAMOS|EMPEZAR|JUGAR/i.test(await p.locator('#letsGoBtn').innerText()) && !/LET'S GO/i.test(await p.locator('#letsGoBtn').innerText()), f + ': opens in Spanish, even on a phone that chose English before (button: ' + (await p.locator('#letsGoBtn').innerText()).trim() + ')');
    const go = p.locator('#letsGoBtn'); await p.screenshot({ path: '/tmp/claude-0/-home-claude/19372268-9eae-501c-85d1-9f5bcca4a2be/scratchpad/modo-' + f.slice(0, 3) + '.png' });
    const vis = await go.isVisible(); if (vis) { await go.click(); await p.waitForTimeout(900) }
    is(vis && !(await go.isVisible()), f + ': the start button is there and opens the game');
    await p.screenshot({ path: '/tmp/claude-0/-home-claude/19372268-9eae-501c-85d1-9f5bcca4a2be/scratchpad/sin-training-' + f.slice(0, 3) + '.png' });
    await c.close();
  }
  is(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(bad ? bad + ' failure(s)' : 'OK') })();
