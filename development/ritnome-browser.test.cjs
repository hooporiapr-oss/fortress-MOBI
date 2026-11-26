'use strict';
// Real Chromium, real Web Audio, synthetic user interaction; no production services.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const allowed=new Set(['ritnome-warmup-preview.html','ritnome-warmup-preview.cjs','ritnome-clock.cjs','ritnome-audio.cjs','authenticated-ritnome.cjs']);
const server=http.createServer((req,res)=>{
 const name=req.url.slice(1);
 if(!allowed.has(name)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(fs.readFileSync(path.join(__dirname,name)));
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort()}return route.continue()});
  await page.addInitScript(()=>{
   window.__ritnomeAudioContexts=[];
   const Original=window.AudioContext;
   window.AudioContext=class extends Original{constructor(...args){super(...args);window.__ritnomeAudioContexts.push(this)}};
  });
  await page.goto(origin+'/ritnome-warmup-preview.html');
  await page.waitForFunction(()=>document.getElementById('start').textContent==='Comenzar');
  assert.equal(await page.locator('html').getAttribute('lang'),'es');
  assert.ok(await page.locator('#personal').isDisabled());
  await page.locator('#language').click();assert.equal(await page.locator('#start').textContent(),'Start');
  await page.locator('#bpm').fill('84');await page.locator('#duration').selectOption('free');
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  await page.waitForFunction(()=>document.querySelectorAll('.beat.on').length===1);
  const audioState=await page.evaluate(()=>window.__ritnomeAudioContexts.map(c=>({state:c.state,currentTime:c.currentTime})));
  assert.equal(audioState.length,1);assert.equal(audioState[0].state,'running');assert.ok(audioState[0].currentTime>0);
  await page.locator('#stop').click();assert.equal(await page.locator('#status').textContent(),'Ready');assert.equal(await page.locator('.beat.on').count(),0);
  await page.locator('#mode').selectOption('tap');assert.ok(await page.locator('#start').isDisabled());
  for(let i=0;i<4;i++){if(i)await page.waitForTimeout(600);await page.locator('#tap').click()}
  assert.ok(await page.locator('#start').isEnabled());
  const tempo=Number((await page.locator('#tempo').textContent()).split(' ')[0]);assert.ok(tempo>=40&&tempo<=200);
  await page.locator('#start').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await page.waitForFunction(()=>window.__ritnomeAudioContexts[0].state==='closed');
  assert.ok(await page.locator('#stop').isDisabled());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);

  // Separate browser context with a synthetic authenticated host. No real tokens or data.
  const personalPage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  personalPage.on('pageerror',e=>errors.push(e.message));
  await personalPage.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort()}return route.continue()});
  await personalPage.addInitScript(()=>{
   const m='00000000-0000-4000-8000-000000000001',p='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
   let selected={membershipId:m,planId:p,sessionEpoch:'one'},listener=null,delayed=null,release=null;
   window.__personalRequests=0;
   window.__changeSelection=()=>{selected=null;listener?.()};
   window.__restoreSelection=()=>{selected={membershipId:m,planId:p,sessionEpoch:'two'};listener?.()};
   window.__delayPrescription=()=>{delayed=new Promise(r=>release=r)};
   window.__releasePrescription=()=>{release?.();delayed=null};
   window.ritnomePersonalHost={enabled:true,getSelection:()=>selected,subscribeSelection(fn){listener=fn;return ()=>{listener=null}},client:{invalidate(){},async request(action,fields){
    window.__personalRequests++;
    if(action!=='get_bpm_plan'||fields.station!=='ritnome'||fields.plan_id!==p||!selected)throw Error('Unexpected request');
    if(delayed)await delayed;
    return {prescription:{membership_id:m,plan_id:p,confirmation_id:c,bpm:84,station:'ritnome',effective_on:'2020-01-01',stage:'11-12'}};
   }}};
  });
  await personalPage.goto(origin+'/ritnome-warmup-preview.html');
  await personalPage.waitForFunction(()=>!document.getElementById('personal').disabled);
  await personalPage.locator('#language').click();
  await personalPage.locator('#mode').selectOption('personal');
  assert.equal(await personalPage.locator('#tempo').textContent(),'— BPM');
  await personalPage.locator('#duration').selectOption('free');
  await personalPage.locator('#start').click();
  await personalPage.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  assert.equal(await personalPage.locator('#tempo').textContent(),'84 BPM');
  await personalPage.waitForFunction(()=>document.querySelectorAll('.beat.on').length===1);
  await personalPage.evaluate(()=>window.__changeSelection());
  assert.equal(await personalPage.locator('#tempo').textContent(),'— BPM');
  assert.equal(await personalPage.locator('.beat.on').count(),0);
  assert.ok(await personalPage.locator('#stop').isDisabled());
  await personalPage.locator('#mode').selectOption('manual');
  await personalPage.locator('#bpm').fill('96');
  await personalPage.locator('#start').click();
  await personalPage.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  assert.equal(await personalPage.locator('#tempo').textContent(),'96 BPM');
  await personalPage.locator('#stop').click();
  await personalPage.locator('#mode').selectOption('tap');
  for(let i=0;i<4;i++){if(i)await personalPage.waitForTimeout(600);await personalPage.locator('#tap').click()}
  await personalPage.locator('#start').click();
  await personalPage.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  await personalPage.locator('#stop').click();
  assert.equal(await personalPage.evaluate(()=>window.__personalRequests),1);
  await personalPage.evaluate(()=>{window.__restoreSelection();window.__delayPrescription()});
  await personalPage.locator('#mode').selectOption('personal');
  await personalPage.locator('#start').click();
  await personalPage.waitForFunction(()=>window.__personalRequests===2);
  await personalPage.evaluate(()=>{window.__changeSelection();window.__releasePrescription()});
  await personalPage.waitForTimeout(300);
  assert.equal(await personalPage.locator('#tempo').textContent(),'— BPM');
  assert.ok(await personalPage.locator('#stop').isDisabled());
  assert.equal(await personalPage.locator('.beat.on').count(),0);
  await personalPage.evaluate(()=>window.__restoreSelection());
  await personalPage.locator('#start').click();
  await personalPage.waitForFunction(()=>document.getElementById('status').textContent==='In rhythm');
  assert.equal(await personalPage.locator('#tempo').textContent(),'84 BPM');
  await personalPage.locator('#stop').click();
  assert.equal(await personalPage.locator('#tempo').textContent(),'— BPM');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  assert.equal(await personalPage.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await personalPage.close();
  console.log('PASS: authenticated host browser flow, personal/manual/tap isolation, selection change and stale response cancellation');
  console.log('PASS: real Chromium Web Audio context, mobile layout, bilingual manual/tap tempo, beat display, stop, pagehide and network isolation');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
