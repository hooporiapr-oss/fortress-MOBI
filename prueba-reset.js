// THE RESET — node prueba-reset.js
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
let fallos=0;const ok=t=>console.log('  ok   '+t),mal=t=>{fallos++;console.log('  BAD  '+t)},si=(c,t)=>c?ok(t):mal(t);
const sitio=http.createServer((q,r)=>{const f=path.join(__dirname,decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'')||'index.html');
  if(!fs.existsSync(f)){r.statusCode=404;return r.end()} r.setHeader('Content-Type','text/html');r.end(fs.readFileSync(f))}).listen(4877);
(async()=>{
  const b=await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{});const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();const errores=[];p.on('pageerror',e=>errores.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errores.push(m.text())});p.on('response',r=>{if(r.status()>=400)errores.push('missing file: '+r.url())});
  await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  /* THE CODE CHECK, FAKED: bw_check says yes to one team code only, and
     the test can switch it to "turned off" or "no connection". */
  let modo='normal';const enviados=[];
  const VALIDOS=['PRUEBACODIGO-4827','PRUEBACODIGO4827'];
  const supa=r=>{const b=JSON.parse(r.request().postData()||'{}');enviados.push(b);
    if(modo==='caido')return r.abort();
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(modo==='apagado'?false:VALIDOS.includes(b.p_code))})};
  await ctx.route(/sdaphocueugzfvjovuxd\.supabase\.co\/rest\/v1\/rpc\/bw_check/,supa);
  console.log('1 · Open to everyone');
  await p.goto('http://127.0.0.1:4877/005-reset.html');
  await p.evaluate(()=>localStorage.setItem('fc-lang','en'));await p.reload();
  si(p.url().endsWith('005-reset.html'),'a link from the Cada Punto home page lands right here, no detour');
  si(await p.isVisible('#s-start'),'no code: it opens straight to the program');
  si(await p.locator('#s-code,#codeIn').count()===0,'and there is no code screen at all');
  si(enviados.length===0,'no code check is ever sent');
  console.log('2 · The hub');
  await p.goto('http://127.0.0.1:4877/fortress-mobile-hub.html');
  si(await p.locator('a[href="005-reset.html"]').count()===1,'the hub has the basketball Reset card');
  si(await p.locator('a[href*="d=volleyball"]').count()===0,'and no volleyball one');
  si(await p.locator('.warm-card .warm-chip').count()===4,'THE FOUR still lists exactly four stations');
  await p.click('a[href="005-reset.html"]');await p.waitForURL(/005-reset/);ok('the card opens the Reset');
  await p.clock.install();await p.reload();
  console.log('3 · First visit: build the routine');
  si(await p.locator('#stDays').innerText()==='0','streak starts at 0');
  await p.click('#goBtn');si(await p.isVisible('#s-build'),'START with no routine → building it');
  si(await p.isDisabled('#buildNext'),'NEXT waits for a cue');
  await p.click('[data-cue="2"]');si(!(await p.isDisabled('#buildNext')),'cue picked → NEXT');
  await p.click('#buildNext');si(await p.isDisabled('#buildNext'),'the breath has to be tried once');
  await p.clock.runFor(10500);si(!(await p.isDisabled('#buildNext')),'after one breath → NEXT');
  await p.click('#buildNext');await p.fill('#ownLine','Lock in.');si(!(await p.isDisabled('#buildNext')),'own line typed → can save');
  await p.click('#buildNext');
  console.log('4 · Five moments');
  si(await p.isVisible('#s-moment'),'the session starts');
  const vistos=new Set();
  for(let i=0;i<5;i++){
    const txt=await p.locator('#momText').innerText();vistos.add(txt);
    si(await p.locator('#momProg').innerText()===(i+1)+' / 5','moment '+(i+1)+' of 5');
    if(i===0){const mala=p.locator('[data-k="w1"]');await mala.click();
      si((await p.locator('#momNudge').innerText()).length>10,'a wrong pick gets a nudge, not a penalty');
      si(await p.isVisible('#s-moment'),'and stays on the moment');}
    await p.click('[data-k="r"]');si(await p.isVisible('#s-run'),'the reset pick runs the routine');
    si((await p.locator('#runBody').innerText()).includes('Look at the rim'),'it starts with the player’s own cue');
    await p.clock.runFor(5000);
    si(await p.isVisible('#cueBtn'),'and the cue waits for the tap, however long it takes');
    await p.click('#cueBtn');await p.clock.runFor(600);
    si(await p.locator('#swish').innerText()==='SWISH!'&&await p.isVisible('#shot'),'the tap is answered with a made shot (the drawn hoop, when the video cannot play)');
    await p.clock.runFor(700);
    si((await p.locator('#whyText').innerText()).length>20,'with why the answer works');
    si((await p.locator('#lifeK').textContent())==='In life too'&&(await p.locator('#lifeText').innerText()).length>20,'and the same lesson in life under it');
    await p.clock.runFor(8000);si(await p.isVisible('#lifeBtn')&&!(await p.isVisible('#runBreath')),'and it waits for the tap');
    await p.click('#lifeBtn');
    si(await p.isVisible('#runBreath'),'then the breath');
    await p.clock.runFor(10100);
    si((await p.locator('#runBody').innerText()).includes('Lock in.'),'and ends on the player’s own line');
    await p.clock.runFor(1900);
  }
  si(vistos.size===5,'five different moments');
  const fuente=fs.readFileSync(path.join(__dirname,'005-reset.html'),'utf8');
  si((fuente.match(/life:\{en:'/g)||[]).length===10&&(fuente.match(/why:\{en:'/g)||[]).length===20,'the moments carry their explanations, and the ten basketball ones a life lesson');
  si(await p.isVisible('#s-done'),'the finish screen');
  si(await p.locator('#dnDays').innerText()==='1'&&await p.locator('#dnTotal').innerText()==='1','streak 1, sessions 1');
  si((await p.locator('#yourReset').innerText()).includes('Lock in.'),'it shows the routine back');
  console.log('5 · Spanish');
  await p.click('#langBtn');
  si((await p.locator('#s-done .title').innerText())==='5 RESETS LISTOS','the finish screen switches to Spanish');
  si((await p.locator('#yourReset').innerText()).startsWith('Mira el aro'),'the routine too');
  await p.goto('http://127.0.0.1:4877/002-recall.html');
  si(await p.evaluate(()=>localStorage.getItem('fc-lang'))==='es','the choice is shared with the other games');
  await p.goto('http://127.0.0.1:4877/005-reset.html');
  si(await p.locator('#goBtn').innerText()==='EMPEZAR','coming back, it opens in Spanish');
  si(await p.locator('.nav-title').innerText()==='EL RESET'&&(await p.locator('#mainTitle').innerText())==='EL RESET','the title is in Spanish too, top bar and start screen');
  si(await p.isVisible('#editBtn'),'and offers to change the routine');
  await p.clock.install();await p.reload();await p.click('#goBtn');await p.click('[data-k="r"]');
  si((await p.locator('#cueBtn').innerText())==='LISTO ✓','in Spanish the cue button says LISTO');
  await p.click('#cueBtn');await p.clock.runFor(600);
  si((await p.locator('#swish').innerText())==='¡ADENTRO!','and the made shot says ¡ADENTRO!');
  await p.clock.runFor(700);
  si((await p.locator('.why-k').innerText()).toLowerCase()==='por qué funciona','the explanation comes in Spanish');
  si(/en la vida/i.test(await p.locator('#explica').innerText()),'and the life card in Spanish too');
  await p.evaluate(()=>{localStorage.setItem('fc-lang','en')});
  console.log('5b · Switching language in the middle of the routine');
  await p.evaluate(()=>localStorage.setItem('fc-lang','en'));
  await p.clock.install();await p.reload();await p.click('#goBtn');await p.click('[data-k="r"]');
  si((await p.locator('#cueText').innerText())==='Look at the rim','cue in English');
  await p.click('#langBtn');
  si((await p.locator('#cueText').innerText())==='Mira el aro'&&(await p.locator('#cueBtn').innerText())==='LISTO ✓','tap ES on the cue screen: the cue switches on the spot');
  await p.click('#langBtn');await p.click('#cueBtn');await p.clock.runFor(1200);
  const whyEn=await p.locator('#whyText').innerText();
  await p.click('#langBtn');
  const whyEs=await p.locator('#whyText').innerText();
  si(whyEs!==whyEn&&(await p.locator('#swish').innerText())==='¡ADENTRO!'&&(await p.locator('#whyK').innerText()).toLowerCase()==='por qué funciona','tap ES on the swish screen: the explanation and the lesson switch on the spot');
  await p.click('#lifeBtn');await p.clock.runFor(500);
  await p.click('#langBtn');
  si((await p.locator('#runK').innerText()).toLowerCase()==='one breath','tap EN during the breath: it switches too');
  await p.clock.runFor(10000);
  await p.click('#langBtn');
  si((await p.locator('#lineText').innerText())==='Lock in.'&&(await p.locator('#runK').innerText()).toLowerCase()==='tu frase','and on the line screen');
  await p.clock.runFor(2000);
  console.log('5c · The made shot is our video');
  {
    /* This test browser cannot play H.264, which every phone can, so it
       is handed the same clip as WebM and told it can play mp4. That
       exercises the real path: the video plays, then SWISH, then the
       cards. The plain run above, where the video cannot play, is the
       fallback path: the drawn hoop. */
    const WEBM=process.env.SWISH_WEBM;
    if(!WEBM||!fs.existsSync(WEBM)){console.log('  skip the video path: run with SWISH_WEBM=<a WebM copy of the clip> to check it')} else {
    const c2=await b.newContext({viewport:{width:390,height:844}});
    await c2.route(/supabase\.co\/rest\/v1\/rpc\/bw_check/,r=>r.fulfill({status:200,contentType:'application/json',body:'true'}));
    await c2.addInitScript(()=>{HTMLMediaElement.prototype.canPlayType=function(){return 'maybe'};localStorage.setItem('rct-mobile-pass','1');localStorage.setItem('cg-reset-codigo','PRUEBACODIGO4827');localStorage.setItem('fc-lang','en');localStorage.setItem('cg-reset-rutina',JSON.stringify({cue:0,line:0,own:''}))});
    const v=await c2.newPage();
    await v.route(/swish-reset\.mp4/,r=>r.fulfill({status:200,contentType:'video/webm',body:fs.readFileSync(WEBM)}));
    await v.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
    await v.goto('http://127.0.0.1:4877/005-reset.html');
    await v.click('#goBtn');await v.click('[data-k="r"]');await v.click('#cueBtn');
    await v.waitForFunction(()=>{const x=document.getElementById('swishVid');return x&&!x.paused&&x.currentTime>=1.4},null,{timeout:5000}).then(()=>ok('the video plays on the swish screen, starting at the shot'),()=>mal('the video did not play'));
    si(await v.locator('#shot').count()===0,'and the drawn hoop stays out of the way');
    await v.waitForFunction(()=>document.getElementById('swish').classList.contains('on'),null,{timeout:5000});
    si(await v.evaluate(()=>document.getElementById('swishVid').currentTime>=2.75),'SWISH lands when the clip reaches the ball going through, not before');
    await v.waitForFunction(()=>document.getElementById('explica').classList.contains('on'),null,{timeout:5000}).then(()=>ok('then the two cards'),()=>mal('the cards did not come in'));
    const vid=await v.evaluateHandle(()=>document.getElementById('swishVid'));
    await v.click('#lifeBtn');
    si(await vid.evaluate(x=>x.paused)&&await v.isVisible('#runBreath'),'NEXT stops the video and moves on to the breath');
    await v.waitForTimeout(10600);await v.waitForTimeout(2000);
    await v.click('[data-k="r"]');await v.click('#cueBtn');
    await v.waitForFunction(()=>{const x=document.getElementById('swishVid');return x&&!x.paused&&x.currentTime>=1.4&&x.currentTime<2.6},null,{timeout:5000}).then(()=>ok('the next moment plays it again from the shot'),()=>mal('the second shot did not play from the start'));
    await c2.close();
    }
  }
  console.log('5d · No volleyball Reset');
  {
    const c3=await b.newContext({viewport:{width:390,height:844}});
    await c3.route(/supabase\.co\/rest\/v1\/rpc\/bw_check/,r=>r.fulfill({status:200,contentType:'application/json',body:'true'}));
    await c3.addInitScript(()=>{localStorage.setItem('fc-lang','en');localStorage.setItem('cg-reset-codigo','PRUEBACODIGO4827')});
    const q=await c3.newPage();await q.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
    await q.goto('http://127.0.0.1:4877/005-reset.html?d=volleyball');
    si(!/volleyball/i.test(await q.locator('#s-start').innerText()),'an old volleyball link opens the basketball Reset');
    await c3.close();
  }
  console.log('6 · Second session the same day, and the next day');
  await p.clock.install();await p.reload();await p.click('#goBtn');
  for(let i=0;i<5;i++){await p.click('[data-k="r"]');await p.click('#cueBtn');await p.clock.runFor(2000);await p.click('#lifeBtn');await p.clock.runFor(14000)}
  si(await p.locator('#dnDays').innerText()==='1'&&await p.locator('#dnTotal').innerText()==='2','same day: streak stays 1, sessions 2');
  await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);const f=x=>x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);localStorage.setItem('cg-reset-dias',JSON.stringify([f(d)]))});
  await p.reload();si(await p.locator('#stDays').innerText()==='1','trained yesterday, not yet today: streak still 1');
  console.log('6b · Later visits');
  await p.reload();si(await p.isVisible('#s-start'),'coming back, it opens straight away');
  await p.evaluate(()=>localStorage.setItem('cg-reset-codigo','OLD-CODE'));await p.reload();
  si(await p.isVisible('#s-start')&&enviados.length===0,'a code saved by the old version changes nothing and is never checked');
  console.log('7 · Nothing leaves the phone, nothing breaks');
  const red=[];p.on('request',q=>{if(!/127\.0\.0\.1|fonts|bw_check/.test(q.url()))red.push(q.url())});
  await p.reload();await p.click('#goBtn');await p.click('[data-k="r"]');await p.click('#cueBtn');await p.clock.runFor(2000);await p.click('#lifeBtn');await p.clock.runFor(14000);
  si(red.length===0&&enviados.length===0,'nothing leaves the device: the routine and streak stay on the phone');
  si(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no sideways scroll at phone width');
  const html=fs.readFileSync(path.join(__dirname,'005-reset.html'),'utf8').toLowerCase();
  si(!/anxiety|ansiedad|therapy|terapia|treat|tratamiento|stress relief|cure|cura/.test(html.replace(/<style[\s\S]*?<\/style>/,'')),'no health or treatment words anywhere on the page');
  si(errores.length===0,'no errors'+(errores.length?': '+errores.join(' | '):''));
  await b.close();sitio.close();
  console.log('\n'+(fallos?'✗ '+fallos+' failure(s)':'✓ the Reset works, in both languages, and stays on the device'));process.exit(fallos?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
