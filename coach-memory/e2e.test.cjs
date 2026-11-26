// End to end in a real browser: Coach View + coach-memory.js against the REAL hooporia-server handler,
// restricted pool and SQL on a disposable PostgreSQL, with fake Supabase Auth on loopback.
// Env: COACH_MEMORY_TEST_DATABASE_URL (restricted login), COACH_MEMORY_TEST_ADMIN_URL, COACH_MEMORY_SERVER_DIR
'use strict';
const assert=require('node:assert/strict');const fs=require('fs'),path=require('path');const {randomUUID}=require('node:crypto');const {execFileSync}=require('node:child_process');
const {chromium,devices}=require('playwright');
const DB=process.env.COACH_MEMORY_TEST_DATABASE_URL;if(!DB){console.log('SKIP: set COACH_MEMORY_TEST_DATABASE_URL');process.exit(0)}
const SERVER=process.env.COACH_MEMORY_SERVER_DIR||path.join(__dirname,'..','..','hooporia-server');
const {start}=require(path.join(SERVER,'coach-memory','local-harness.cjs'));
const psql=q=>execFileSync('psql',[process.env.COACH_MEMORY_TEST_ADMIN_URL||DB,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',q]).toString().trim();
const asAdmin=(uid,q)=>psql(`begin; set local role authenticated; set local request.jwt.claim.sub='${uid}'; ${q}; commit;`);
const SITE='https://hooporia.mobi',SB='https://sdaphocueugzfvjovuxd.supabase.co',API='https://cognitivo-gym-server.onrender.com';
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(n,v)=>{v?pass++:fail++;console.log((v?'✔ ':'✘ ')+n)};
const wait=async(f,ms=15000)=>{for(let t=0;t<ms;t+=250){if(await f())return true;await new Promise(r=>setTimeout(r,250))}return false};
const day=d=>new Date(Date.now()-d*864e5).toISOString();
const COACH={school:'Local Program',schools:['Local Program'],teams:null,team_of:{},
 players:[{name:'Ana T',age:8,grade:'3',at:day(1)},{name:'Beto T',age:12,grade:'7',at:day(2)}],
 runs:[{name:'Ana T',age:8,grade:'3',game:'recall',score:2,at:day(5)},{name:'Ana T',age:8,grade:'3',game:'recall',score:3,at:day(1)},{name:'Ana T',age:8,grade:'3',game:'fortress',score:4,at:day(1)},{name:'Beto T',age:12,grade:'7',game:'recall',score:5,at:day(1)}]};
(async()=>{const h=await start({databaseUrl:DB,sql:async q=>psql(q)});const browser=await chromium.launch();
 try{
  const admin=randomUUID();psql(`insert into auth.users(id,email) values('${admin}','admin-${admin.slice(0,8)}@example.test'); insert into public.admins values('${admin}');`);
  const A='coach-a-'+randomUUID().slice(0,8)+'@example.test',B='coach-b-'+randomUUID().slice(0,8)+'@example.test';
  await h.register(A,'pw-A-12345');await h.register(B,'pw-B-12345');
  asAdmin(admin,`select public.cm_admin_bootstrap('Local Program')`);
  const m1=asAdmin(admin,`select public.cm_admin_enroll('Local Program','Team 8 · #23')`),m2=asAdmin(admin,`select public.cm_admin_enroll('Local Program','Team 12 · #7')`);
  asAdmin(admin,`select public.cm_admin_grant_coach('${m1}','${A}')`);asAdmin(admin,`select public.cm_admin_grant_coach('${m2}','${B}')`);
  async function context(dev){const c=await browser.newContext({...dev});
   await c.route(/^https:\/\//,async r=>{const u=new URL(r.request().url());
    if(u.origin===SITE){const f=path.join(ROOT,u.pathname.replace(/^\//,''));return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''})}
    if(u.origin===SB&&u.pathname.startsWith('/auth/v1/'))return r.fulfill({response:await r.fetch({url:h.authUrl+u.pathname+u.search})});
    if(u.origin===SB&&u.pathname.endsWith('/rpc/hooporia_coach'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(COACH)});
    if(u.origin===SB)return r.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(u.origin===API&&u.pathname==='/v1/coach-memory')return r.fulfill({response:await r.fetch({url:h.apiUrl+u.pathname,headers:{...r.request().headers(),origin:SITE}})});
    return r.abort()});
   return c}
  const c=await context(devices['iPhone 13']);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const openView=async()=>{await p.goto(SITE+'/coach.html');await p.fill('#code','COACH1');await p.click('#open');await p.waitForTimeout(800);await p.evaluate(()=>{document.getElementById('ap').open=true});await p.selectOption('#apSelect','ana t');await p.waitForTimeout(300)};
  await openView();
  ok('Coach Memory section is inside the athlete profile, signed out',await p.isVisible('#cm')&&/No coach session|Sin sesión/.test(await p.textContent('#cmWho'))&&!(await p.isVisible('#cmWork')));
  ok('Goal Center still works as before (session-only) while signed out',await p.isVisible('#gc'));
  await p.fill('#cmEmail',A);await p.fill('#cmPass','wrong-pw');await p.click('#cmSignin');await p.waitForTimeout(600);
  ok('Wrong password is refused',/incorrect|Wrong/.test(await p.textContent('#cmAuthStatus')));
  await p.fill('#cmPass','pw-A-12345');await p.click('#cmSignin');
  ok('Coach A signs in and sees her one enrollment with its label',await wait(async()=>(await p.$$eval('#cmEnroll option',o=>o.map(x=>x.textContent))).some(t=>/Team 8 · #23 · Local Program/.test(t))));
  ok('Password field cleared after sign-in',await p.$eval('#cmPass',e=>e.value==='')&&!(await p.isVisible('#cmAuthForm')));
  await p.selectOption('#cmEnroll',m1);await p.waitForTimeout(800);
  ok('Selecting the enrollment shows the plan form and the panel',await p.isVisible('#cmDraft')&&await p.isVisible('#cmPanel button'));
  await p.click('#cmPanel button:has-text("Guardar plan"), #cmPanel button:has-text("Save training plan")');
  ok('Plan saved to the backend',await wait(()=>psql(`select count(*) from coach_memory_private.event where membership_id='${m1}' and kind='training_plan'`)==='1'));
  ok('Panel confirms the save',await wait(async()=>/Plan guardado|Plan saved/.test(await p.textContent('#cmPanel'))));
  // Goal Center → persisted goal
  const recallIdx=await p.$$eval('#gcMetric option',o=>o.findIndex(x=>/^Recall/.test(x.textContent)));
  await p.selectOption('#gcMetric',String(recallIdx));await p.fill('#gcTarget','5');await p.click('#gcAdd');
  ok('Goal added in Goal Center and saved to Coach Memory',await wait(async()=>/guardada|saved/.test(await p.textContent('#gcMemory')))&&psql(`select count(*) from coach_memory_private.event where membership_id='${m1}' and kind='goal'`)==='1');
  await p.screenshot({path:path.join(__dirname,'e2e-mobile.png'),fullPage:true});
  // reload: session survives in this tab, plan history and goal come back
  await openView();
  ok('After reload: still signed in, enrollment list back',await wait(async()=>(await p.$$eval('#cmEnroll option',o=>o.length))===2));
  await p.selectOption('#cmEnroll',m1);
  ok('After reload: saved plan shows in history',await wait(async()=>/Consultar plan anterior|Review previous plan/.test(await p.textContent('#cmPanel'))));
  ok('After reload: goal restored into Goal Center from memory',await wait(async()=>/cargadas|loaded/.test(await p.textContent('#gcMemory'))&&/Recall/.test(await p.textContent('#gcOut'))));
  // switching athlete profile clears memory note; switching enrollment to none hides form
  await p.selectOption('#apSelect','beto t');await p.waitForTimeout(400);
  ok('Switching athlete profile deselects the enrollment (no goals carried over)',(await p.textContent('#gcMemory'))===''&&!(await p.isVisible('#cmDraft'))&&await p.evaluate(()=>!window.__coachMemory.state().membershipId));
  await p.selectOption('#apSelect','ana t');await p.selectOption('#cmEnroll',m1);await p.waitForTimeout(300);
  await p.selectOption('#cmEnroll','');await p.waitForTimeout(200);ok('Deselecting the enrollment hides the plan form',!(await p.isVisible('#cmDraft')));
  // English
  await p.click('#cvLang [data-l=en]');await p.waitForTimeout(300);ok('English labels',/Coach Memory/.test(await p.textContent('#cmTitle'))&&/Verified enrollment/.test(await p.textContent('#cmEnrollL')));
  // lock clears session
  await p.click('#lockBtn');await p.waitForTimeout(300);
  ok('Lock signs the coach out and clears the tab session',await p.evaluate(()=>!sessionStorage.getItem('cm-session')));
  await p.fill('#code','COACH1');await p.click('#open');await p.waitForTimeout(600);await p.evaluate(()=>{document.getElementById('ap').open=true});await p.selectOption('#apSelect','ana t');
  ok('After lock: signed out again',/No coach session|Sin sesión/.test(await p.textContent('#cmWho')));
  // coach B sees only his enrollment; cannot reach A's
  await p.fill('#cmEmail',B);await p.fill('#cmPass','pw-B-12345');await p.click('#cmSignin');
  ok('Coach B sees only his enrollment',await wait(async()=>{const o=await p.$$eval('#cmEnroll option',o=>o.map(x=>x.value));return o.length===2&&o.includes(m2)&&!o.includes(m1)}));
  const forged=await p.evaluate(async id=>{try{window.__coachMemory.controller.select(id);const r=await window.__coachMemory.controller.history();return 'got '+r.records.length}catch(e){return e.code}},m1);
  ok('Coach B forcing A\'s membership id is refused by the backend ('+forged+')',forged==='forbidden');
  ok('No page errors '+errs.join('|'),!errs.length);
  await c.close();
  // desktop pass
  const d=await context({viewport:{width:1280,height:900}});const q=await d.newPage();const e2=[];q.on('pageerror',e=>e2.push(e.message));
  await q.goto(SITE+'/coach.html');await q.fill('#code','COACH1');await q.click('#open');await q.waitForTimeout(800);await q.evaluate(()=>{document.getElementById('ap').open=true});await q.selectOption('#apSelect','ana t');
  await q.fill('#cmEmail',A);await q.fill('#cmPass','pw-A-12345');await q.click('#cmSignin');await wait(async()=>(await q.$$eval('#cmEnroll option',o=>o.length))===2);await q.selectOption('#cmEnroll',m1);
  ok('Desktop: history and goal load',await wait(async()=>/Consultar plan anterior|Review previous plan/.test(await q.textContent('#cmPanel'))&&/cargadas|loaded/.test(await q.textContent('#gcMemory'))));
  ok('Desktop: no sideways scroll, no errors',await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&!e2.length);
  await q.screenshot({path:path.join(__dirname,'e2e-desktop.png'),fullPage:false});await d.close();
 }finally{await h.stop();await browser.close()}
 console.log('PASS',pass,'FAIL',fail);process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e.stack||e.message);process.exit(1)});
