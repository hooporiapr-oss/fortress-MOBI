'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const names=['coach-memory-client.cjs','auth-coach-memory.cjs','coach-memory-panel.cjs'];
const fixture=`
const modules={};function load(name){return modules[name].exports}
`+names.map(n=>'modules["./'+n+'"]={exports:{}};(function(module,require){'+read(n)+'\n})(modules["./'+n+'"],load);').join('\n')+`
const {createAuthCoachMemory}=load('./auth-coach-memory.cjs'),{mountCoachMemoryPanel}=load('./coach-memory-panel.cjs');
const $=id=>document.getElementById(id);
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',U='10000000-0000-4000-8000-000000000003';
let cb, signed=false, panel, language='es', hold=null, release=null, failSave=false;
const records=new Map([[A,[]],[B,[]]]), calls=[];
const auth={onAuthStateChange(fn){cb=fn;return {data:{subscription:{unsubscribe(){cb=null}}}}},async getUser(){return signed?{data:{user:{id:U,is_anonymous:false}},error:null}:{data:{user:null},error:Error('signed out')}}};
const controller=createAuthCoachMemory({auth,enabled:true,endpoint:'https://example.invalid/v1/coach-memory',onChange(s){if(!s.authenticated)$('enrollment').value='';panel?.refresh()},fetchImpl:async(url,o)=>{
 const p=JSON.parse(o.body);calls.push(p);const rows=records.get(p.membership_id);if(!rows)return {ok:false,status:403};
 if(p.action==='save_plan'){let record=rows.find(r=>r.id===p.request_id);if(!record){record={id:p.request_id,kind:'training_plan',effective_on:p.effective_on,recorded_at:new Date().toISOString(),payload:p.plan};rows.unshift(record)}
 if(failSave){failSave=false;throw Error('simulated lost response')}return {ok:true,json:async()=>({id:record.id})}}
 if(p.action==='read'){const copy=structuredClone(rows);if(hold)await hold;return {ok:true,json:async()=>({records:copy})}}
 throw Error('Unexpected action')
}});
panel=mountCoachMemoryPanel({root:$('panel'),controller,getDraft:()=>({effectiveOn:$('date').value,stage:$('stage').value,days:Number($('days').value),stations:['fortress','recall']})});
$('login').onclick=()=>{signed=true;cb('SIGNED_IN',{access_token:'synthetic.test.token',expires_at:Math.floor(Date.now()/1000)+120,user:{id:U}})};
$('logout').onclick=()=>{signed=false;cb('SIGNED_OUT',null)};
$('enrollment').onchange=()=>controller.select(({a:A,b:B})[$('enrollment').value]||null);
$('lang').onclick=()=>{language=language==='es'?'en':'es';document.documentElement.lang=language;panel.setLanguage(language)};
window.fixture={calls,hold(){hold=new Promise(r=>release=r)},release(){release?.();hold=null},failSave(){failSave=true},state:()=>controller.state()};
`;
const server=http.createServer((req,res)=>{const p=req.url;if(p==='/coach-memory-preview.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(read('coach-memory-preview.html'))}else if(p==='/coach-memory-preview-fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture)}else{res.writeHead(404);res.end()}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){external.push(r.request().url());return r.abort()}return r.continue()});
 await page.goto(origin+'/coach-memory-preview.html');
 const save=page.locator('#panel button').nth(0),history=page.locator('#panel button').nth(1),status=page.locator('#panel [role=status]'),rows=page.locator('#panel details');
 assert.equal(await save.isDisabled(),true);await page.locator('#login').click();await page.waitForFunction(()=>fixture.state().authenticated);
 await page.locator('#enrollment').selectOption('a');assert.equal(await save.isEnabled(),true);
 await save.click();await page.waitForFunction(()=>document.querySelector('#panel [role=status]').textContent==='Plan guardado.');
 await history.click();await rows.first().waitFor();assert.equal(await rows.count(),1);await rows.first().locator('summary').click();assert.match(await rows.first().innerText(),/11-12/);
 await page.locator('#lang').click();assert.equal(await save.textContent(),'Save training plan');
 await page.locator('#days').selectOption('4');await page.evaluate(()=>fixture.failSave());await save.click();await page.waitForFunction(()=>document.querySelector('#panel [role=status]').textContent.startsWith('Request failed'));
 await save.click();await page.waitForFunction(()=>document.querySelector('#panel [role=status]').textContent==='Plan saved.');
 const saves=await page.evaluate(()=>fixture.calls.filter(c=>c.action==='save_plan'));assert.equal(saves.length,3);assert.equal(saves[1].request_id,saves[2].request_id);assert.equal(saves[2].plan.bpm,null);
 await history.click();await page.waitForFunction(()=>document.querySelectorAll('#panel details').length===2);
 await page.evaluate(()=>fixture.hold());await history.click();await page.waitForFunction(()=>document.querySelector('#panel [role=status]').textContent==='Loading…');
 await page.locator('#enrollment').selectOption('b');await page.evaluate(()=>fixture.release());assert.equal(await rows.count(),0);
 await history.click();await page.waitForFunction(()=>document.querySelector('#panel [role=status]').textContent==='No saved training plans.');
 await page.locator('#enrollment').selectOption('a');await history.click();await page.waitForFunction(()=>document.querySelectorAll('#panel details').length===2);
 await page.locator('#logout').click();assert.equal(await rows.count(),0);assert.equal(await save.isDisabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS: mobile bilingual Coach Memory UI, controller, scoped save/history, lost-response retry, athlete switching and logout');
 }finally{await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
