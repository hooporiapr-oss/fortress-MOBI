/* Built by coach-memory/build.cjs — edit the files in coach-memory/src, not this file. */
(function(){
const modules={};function load(name){return modules[name].exports}
modules["./coach-memory-client.cjs"]={exports:{}};(function(module,require){// Development-only frontend transport. Not loaded by the live Coach View.
'use strict';
function createCoachMemoryClient({endpoint,enabled=false,getContext,fetchImpl=globalThis.fetch}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/v1/coach-memory'||typeof getContext!=='function')throw Error('Invalid configuration');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const fail=code=>Object.assign(new Error('Coach Memory unavailable'),{code});
 let generation=0;
 function invalidate(){generation++}
 async function request(action,fields={}){
  if(!enabled)throw fail('disabled');
  const listing=action==='list_enrollments',g=generation,ctx=await getContext(action);
  if(g!==generation)throw fail('selection_changed');
  if(!ctx||(!listing&&!uuid(ctx.membershipId))||typeof ctx.accessToken!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(ctx.accessToken)||ctx.accessToken.length>8192)throw fail('authentication_required');
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw fail('invalid_request');
  const keys={list_enrollments:['page_size','after_id'],save_goal:['request_id','effective_on','goal'],submit_bpm:['request_id','bpm','measured_at'],confirm_bpm:['request_id','measurement_id'],save_bpm_plan:['request_id','confirmation_id','effective_on','plan'],save_plan:['request_id','effective_on','plan'],read:['page_size','before_time','before_id'],get_bpm_plan:['plan_id','station']}[action];
  if(!Array.isArray(keys)||Object.keys(fields).some(k=>!keys.includes(k)))throw fail('invalid_request');
  if(!listing&&action!=='read'&&action!=='get_bpm_plan'&&!uuid(fields.request_id))throw fail('invalid_request');
  if(listing&&((fields.page_size!=null&&(!Number.isInteger(fields.page_size)||fields.page_size<1||fields.page_size>100))||(fields.after_id!=null&&!uuid(fields.after_id))))throw fail('invalid_request');
  if(action==='get_bpm_plan'&&(!uuid(fields.plan_id)||!['recall','recognition','replay','fortress','zn','zr','enc','ritnome'].includes(fields.station)))throw fail('invalid_request');
  if(action==='submit_bpm'&&(!Number.isInteger(fields.bpm)||fields.bpm<1||fields.bpm>1000||typeof fields.measured_at!=='string'||!Number.isFinite(Date.parse(fields.measured_at))))throw fail('invalid_request');
  if(action==='confirm_bpm'&&!uuid(fields.measurement_id))throw fail('invalid_request');
  if(action==='save_bpm_plan'&&(!uuid(fields.confirmation_id)||!fields.plan||Object.hasOwn(fields.plan,'bpm')))throw fail('invalid_request');
  if(action==='save_goal'){const p=fields.goal;if(typeof fields.effective_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fields.effective_on)||!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==3||!['active_days','reaction_bpm','recall','recognition','replay','fortress'].includes(p.metric)||!Number.isInteger(p.baseline)||!Number.isInteger(p.target)||p.baseline<0||p.target<=p.baseline||p.target>99999||(p.metric==='active_days'&&p.target>7))throw fail('invalid_request');}
  if(action==='save_plan'&&fields.plan?.bpm!==null)throw fail('invalid_request');
  let res;
  try{res=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ctx.accessToken},body:JSON.stringify({...fields,action,...(listing?{}:{membership_id:ctx.membershipId})}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)})}catch{throw fail('unavailable')}
  if(g!==generation)throw fail('selection_changed');
  if(!res.ok)throw fail(({400:'invalid_request',401:'authentication_required',403:'forbidden'})[res.status]||'unavailable');
  let data;try{data=await res.json()}catch{throw fail('unavailable')}
  if(g!==generation)throw fail('selection_changed');
  if(listing){const rows=data?.enrollments;if(!Array.isArray(rows)||rows.length>(fields.page_size??25)||rows.some(r=>!uuid(r.membership_id)||typeof r.program_key!=='string'||!r.program_key.trim()||r.program_key.length>200||(r.label!=null&&(typeof r.label!=='string'||r.label.length>80))))throw fail('unavailable');return {enrollments:rows.map(r=>({membership_id:r.membership_id,program_key:r.program_key,label:typeof r.label==='string'&&r.label.trim()?r.label:null}))};}
  if(action==='get_bpm_plan'){
   const p=data?.prescription;
   if(!p||p.membership_id!==ctx.membershipId||p.plan_id!==fields.plan_id||p.station!==fields.station||!uuid(p.confirmation_id)||!Number.isInteger(p.bpm)||p.bpm<1||p.bpm>1000||typeof p.effective_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_on)||!['5-6','7-8','9-10','11-12','13-14','15-17','other'].includes(p.stage))throw fail('unavailable');
   return {prescription:Object.freeze({membership_id:p.membership_id,plan_id:p.plan_id,confirmation_id:p.confirmation_id,station:p.station,bpm:p.bpm,effective_on:p.effective_on,stage:p.stage})};
  }
  if(action==='read'?!Array.isArray(data?.records):!uuid(data?.id))throw fail('unavailable');
  return action==='read'?{records:data.records}:{id:data.id};
 }
 return {request,invalidate};
}
if(typeof module!=='undefined')module.exports={createCoachMemoryClient};

})(modules["./coach-memory-client.cjs"],load);
modules["./auth-coach-memory.cjs"]={exports:{}};(function(module,require){'use strict';
// Development only. No BPM prescriptions, legacy gate credentials or persistent browser storage.
const {createCoachMemoryClient}=require('./coach-memory-client.cjs');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=code=>Object.assign(Error('Coach Memory unavailable'),{code});
function createAuthCoachMemory({auth,endpoint,enabled=false,fetchImpl,onChange=()=>{}}={}){
 if(!auth||typeof auth.getUser!=='function'||typeof auth.onAuthStateChange!=='function')throw Error('Auth required');
 let closed=false,epoch=0,session=null,membership=null,revision=0,timer;
 function emit(){try{onChange(state())}catch{}}
 function state(){return Object.freeze({authenticated:!!(session&&session.expiry>Date.now()),membershipId:membership,enabled:enabled&&!closed})}
 function clear(){epoch++;revision++;session=null;membership=null;clearTimeout(timer);client.invalidate();emit()}
 const client=createCoachMemoryClient({endpoint,enabled,fetchImpl,getContext:async(action)=>{
  const s=session,m=membership,g=revision;
  if(closed||!s||(!m&&action!=='list_enrollments')||s.expiry<=Date.now())return null;
  try{const {data,error}=await auth.getUser(s.token);
   if(error||data?.user?.id!==s.id||data?.user?.is_anonymous!==false){if(session===s)clear();return null}
   if(closed||session!==s||membership!==m||g!==revision||s.expiry<=Date.now())return null;
   return {membershipId:m,accessToken:s.token};
  }catch{if(session===s)clear();return null}
 }});
 async function verify(s,g){
  try{const token=s?.access_token,expiry=Number(s?.expires_at)*1000;
   if(!enabled||closed||g!==epoch||typeof token!=='string'||!/^[-\w]+[.][-\w]+[.][-\w]+$/.test(token)||!Number.isFinite(expiry)||expiry<=Date.now())return;
   const {data,error}=await auth.getUser(token);
   if(closed||g!==epoch||error||!uuid(data?.user?.id)||data.user.id!==s.user?.id||data.user.is_anonymous!==false||expiry<=Date.now())return;
   session={id:data.user.id,token,expiry};timer=setTimeout(()=>{if(g===epoch)clear()},Math.min(expiry-Date.now(),2147483647));timer.unref?.();emit();
  }catch{if(g===epoch)clear()}
 }
 const {data:{subscription}}=auth.onAuthStateChange((event,s)=>{if(closed)return;clear();const g=epoch;if(s&&event!=='SIGNED_OUT')setTimeout(()=>void verify(s,g),0)});
 function select(id){if(!enabled||closed||!session||session.expiry<=Date.now())throw fail('authentication_required');if(id!==null&&!uuid(id))throw fail('invalid_request');revision++;client.invalidate();membership=id;emit()}
 function savePlan({requestId,effectiveOn,stage,days,stations}={}){
  if(!uuid(requestId)||typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)||!['5-6','7-8','9-10','11-12','13-14','15-17','other'].includes(stage)||!Number.isInteger(days)||days<2||days>5||!Array.isArray(stations)||!stations.length||new Set(stations).size!==stations.length||stations.some(s=>!['recall','recognition','replay','fortress','zn','zr','enc','ritnome'].includes(s)))return Promise.reject(fail('invalid_request'));
  return client.request('save_plan',{request_id:requestId,effective_on:effectiveOn,plan:{stage,days,stations:[...stations],bpm:null}});
 }
 function saveGoal({requestId,effectiveOn,metric,baseline,target}={}){
  return client.request('save_goal',{request_id:requestId,effective_on:effectiveOn,goal:{metric,baseline,target}});
 }
 function listEnrollments({pageSize=25,afterId}={}){
  return client.request('list_enrollments',{page_size:pageSize,...(afterId!=null?{after_id:afterId}:{})});
 }
 function history({pageSize=25,beforeTime,beforeId}={}){
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100||(beforeTime==null)!==(beforeId==null)||(beforeId!=null&&(!uuid(beforeId)||typeof beforeTime!=='string'||!Number.isFinite(Date.parse(beforeTime)))))return Promise.reject(fail('invalid_request'));
  return client.request('read',{page_size:pageSize,...(beforeId!=null?{before_time:beforeTime,before_id:beforeId}:{})});
 }
 function dispose(){if(closed)return;closed=true;clear();subscription.unsubscribe()}
 return Object.freeze({state,select,savePlan,saveGoal,listEnrollments,history,dispose});
}
module.exports={createAuthCoachMemory};

})(modules["./auth-coach-memory.cjs"],load);
modules["./coach-memory-panel.cjs"]={exports:{}};(function(module,require){'use strict';
// Development UI adapter. Requires an explicitly supplied authenticated controller.
// No legacy name-based identity, local storage, or automatic production activation.
const T={
 en:{title:'Coach Memory',notice:'Select a verified enrollment to save or review training plans.',save:'Save training plan',history:'Training history',more:'Load more',empty:'No saved training plans.',saved:'Plan saved.',loading:'Loading…',saving:'Saving…',error:'Request failed. Verify access or retry.',ready:'Ready',stage:'Developmental stage',days:'Days per week',stations:'Stations',date:'Effective date',review:'Review previous plan',retry:'Retry the same save before changing the plan.'},
 es:{title:'Memoria del entrenador',notice:'Seleccione una membresía verificada para guardar o consultar planes.',save:'Guardar plan',history:'Historial de entrenamiento',more:'Cargar más',empty:'No hay planes guardados.',saved:'Plan guardado.',loading:'Cargando…',saving:'Guardando…',error:'No se completó la solicitud. Verifique el acceso o reintente.',ready:'Listo',stage:'Etapa de desarrollo',days:'Días por semana',stations:'Estaciones',date:'Fecha de vigencia',review:'Consultar plan anterior',retry:'Reintente el mismo guardado antes de cambiar el plan.'}
};
function mountCoachMemoryPanel({root,controller,getDraft,randomUUID=()=>globalThis.crypto.randomUUID(),language='es'}={}){
 if(!root||!controller||typeof getDraft!=='function')throw Error('Panel configuration required');
 const doc=root.ownerDocument;let lang=language==='en'?'en':'es',epoch=0,busy=false,pending=null,records=[],cursor=null,closed=false,lastScope=null,status='ready';
 const el=(tag)=>doc.createElement(tag);
 const title=el('h3'),notice=el('p'),save=el('button'),history=el('button'),more=el('button'),message=el('p'),list=el('div');
 for(const b of [save,history,more])b.type='button';
 message.setAttribute('role','status');list.setAttribute('aria-live','polite');
 root.replaceChildren(title,notice,save,history,message,list,more);
 function scope(){const s=controller.state();return s.enabled&&s.authenticated&&s.membershipId?s.membershipId:null}
 function reset(){epoch++;busy=false;pending=null;records=[];cursor=null;status='ready';list.replaceChildren()}
 function sync(){const current=scope();if(current!==lastScope){reset();lastScope=current}render()}
 function render(){const t=T[lang],active=!!scope()&&!closed;title.textContent=t.title;notice.textContent=t.notice;save.textContent=t.save;history.textContent=t.history;more.textContent=t.more;save.disabled=!active||busy;history.disabled=!active||busy;more.hidden=!cursor;more.disabled=!active||busy;message.textContent=t[status]||t.error;
 list.replaceChildren();if(!active)return;
 for(const r of records){const d=el('details'),summary=el('summary'),p=el('p');summary.textContent=t.review+' · '+r.effective_on;p.textContent=[t.stage+': '+r.payload.stage,t.days+': '+r.payload.days,t.stations+': '+r.payload.stations.join(', ')].join(' · ');d.append(summary,p);list.append(d)}
 }
 function validRecord(r){return r&&r.kind==='training_plan'&&typeof r.id==='string'&&typeof r.effective_on==='string'&&typeof r.recorded_at==='string'&&r.payload&&typeof r.payload.stage==='string'&&Number.isInteger(r.payload.days)&&Array.isArray(r.payload.stations)&&r.payload.stations.every(s=>typeof s==='string')}
 async function run(kind,append=false){sync();if(closed||busy||!scope())return;const g=epoch,m=scope();busy=true;status=kind==='save'?'saving':'loading';render();
 try{if(kind==='save'){const draft=getDraft();if(!draft)throw Error('Missing plan');const clean={effectiveOn:draft.effectiveOn,stage:draft.stage,days:draft.days,stations:[...draft.stations]};const key=JSON.stringify(clean);
 if(pending&&pending.key!==key){status='retry';return}if(!pending)pending={key,requestId:randomUUID(),draft:clean};
 await controller.savePlan({...pending.draft,requestId:pending.requestId});if(g!==epoch||scope()!==m||closed)return;pending=null;status='saved';
 }else{const page=await controller.history(append&&cursor?{beforeTime:cursor.time,beforeId:cursor.id}:{});if(g!==epoch||scope()!==m||closed)return;
 const incoming=page.records.filter(validRecord);records=append?[...records,...incoming.filter(r=>!records.some(a=>a.id===r.id))]:incoming;
 const last=page.records.at(-1);cursor=page.records.length===25&&last?.recorded_at&&last?.id?{time:last.recorded_at,id:last.id}:null;status=records.length?'ready':'empty';
 }}catch{if(g===epoch&&scope()===m&&!closed)status='error'}finally{if(g===epoch&&!closed){busy=false;sync()}}
 }
 save.onclick=()=>void run('save');history.onclick=()=>void run('history');more.onclick=()=>void run('history',true);
 sync();
 return Object.freeze({history(){void run('history')},refresh(){reset();lastScope=scope();render()},setLanguage(value){lang=value==='en'?'en':'es';sync()},dispose(){closed=true;reset();root.replaceChildren();save.onclick=history.onclick=more.onclick=null}});
}
module.exports={mountCoachMemoryPanel};

})(modules["./coach-memory-panel.cjs"],load);
modules["./goal-center-persistence.cjs"]={exports:{}};(function(module,require){'use strict';
// Development-only bridge for the existing Goal Center. No name-based identity.
// Only canonical MOBI level metrics may use v1 station goals; other modes remain session-only.
const supported=Object.freeze({weekly:'active_days',reaction:'reaction_bpm'});
const stations=['fortress','recall','recognition','replay'];
function metricKey(m){if(!m)return null;if(Object.hasOwn(supported,m.id))return supported[m.id];if(stations.includes(m.station)&&m.mode===''&&m.unit==='level'&&m.id===JSON.stringify([m.station,'','level']))return m.station;return null}
function goalKey(metric){return metric==='active_days'?'weekly':metric==='reaction_bpm'?'reaction':stations.includes(metric)?JSON.stringify([metric,'','level']):null}
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=code=>Object.assign(Error('Goal persistence unavailable'),{code});
function createGoalCenterPersistence({controller,randomUUID=()=>globalThis.crypto.randomUUID()}={}){
 if(!controller||typeof controller.saveGoal!=='function'||typeof controller.history!=='function'||typeof controller.state!=='function')throw Error('Controller required');
 let generation=0,pending=null,closed=false,busy=false;
 function scope(){const s=controller.state();return !closed&&s.enabled&&s.authenticated&&uuid(s.membershipId)?s.membershipId:null}
 function invalidate(){generation++;pending=null;busy=false}
 function assertScope(m,g){if(!m||scope()!==m||generation!==g)throw fail('selection_changed')}
 function canPersist(metric){return !!metric&&metricKey(metric)!==null&&Number.isInteger(metric.current)&&metric.current>=0&&Number.isInteger(metric.max)&&metric.max>metric.current}
 async function save({metric,target,effectiveOn}={}){
  const m=scope(),g=generation;if(!m)throw fail('authentication_required');if(busy)throw fail('busy');
  if(!canPersist(metric)||!Number.isInteger(target)||target<=metric.current||target>metric.max||target>99999||(metric.id==='weekly'&&target>7)||typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn))throw fail('invalid_request');
  const draft={metric:metricKey(metric),baseline:metric.current,target,effectiveOn},key=JSON.stringify(draft);
  if(pending&&pending.membership!==m)pending=null;
  if(pending&&pending.key!==key)throw fail('retry_original');
  if(!pending)pending={membership:m,key,requestId:randomUUID()};
  busy=true;try{const result=await controller.saveGoal({...draft,requestId:pending.requestId});assertScope(m,g);if(!uuid(result?.id))throw fail('unavailable');pending=null;return result}
  finally{if(g===generation)busy=false}
 }
 async function load({maxPages=20}={}){
  const m=scope(),g=generation;if(!m)throw fail('authentication_required');if(!Number.isInteger(maxPages)||maxPages<1||maxPages>100)throw fail('invalid_request');
  let cursor=null;const seen=new Set(),latest=new Map();
  for(let i=0;i<maxPages;i++){
   const page=await controller.history({pageSize:100,...(cursor?{beforeTime:cursor.time,beforeId:cursor.id}:{})});assertScope(m,g);
   if(!Array.isArray(page?.records)||page.records.length>100)throw fail('unavailable');
   for(const r of page.records){const p=r?.payload;if(r?.kind!=='goal'||!uuid(r.id)||!p)continue;
    const id=goalKey(p.metric);
    if(!id||latest.has(id)||!Number.isInteger(p.baseline)||!Number.isInteger(p.target)||p.baseline<0||p.target<=p.baseline||p.target>99999||(id==='weekly'&&p.target>7))continue;
    latest.set(id,{id,start:p.baseline,target:p.target,recordId:r.id,effectiveOn:r.effective_on});
   }
   if(page.records.length<100)return {goals:[...latest.values()],complete:true};
   const last=page.records.at(-1);if(!uuid(last?.id)||typeof last.recorded_at!=='string'||!Number.isFinite(Date.parse(last.recorded_at)))throw fail('unavailable');
   const key=JSON.stringify([last.recorded_at,last.id]);if(seen.has(key))throw fail('unavailable');seen.add(key);cursor={time:last.recorded_at,id:last.id};
  }
  return {goals:[...latest.values()],complete:false};
 }
 return Object.freeze({canPersist,save,load,invalidate,dispose(){closed=true;invalidate()}});
}
module.exports={createGoalCenterPersistence};

})(modules["./goal-center-persistence.cjs"],load);
window.__coachMemoryModules={createAuthCoachMemory:load("./auth-coach-memory.cjs").createAuthCoachMemory,mountCoachMemoryPanel:load("./coach-memory-panel.cjs").mountCoachMemoryPanel,createGoalCenterPersistence:load("./goal-center-persistence.cjs").createGoalCenterPersistence};
})();
// Coach Memory inside Coach View: named coach sign-in, verified enrollments, saved plans/history,
// and persistent goals through the existing Goal Center. Loaded by coach.html after its own script.
// Nothing here matches athletes by name: the coach picks the enrollment and the athlete profile separately.
(function(){
'use strict';
var CM_ENDPOINT='https://cognitivo-gym-server.onrender.com/v1/coach-memory';
var CM_TEXT={
 es:{title:'Memoria del entrenador',intro:'Planes y metas individuales que se conservan entre sesiones. Requiere su cuenta de entrenador y una membresía verificada asignada por el programa.',email:'Correo',password:'Contraseña',signin:'Entrar',signup:'Crear cuenta',signout:'Salir',signedin:'Sesión de entrenador activa',signedout:'Sin sesión de entrenador',badlogin:'Correo o contraseña incorrectos.',created:'Cuenta creada. Revise su correo para confirmarla y luego pida al programa que le asigne atletas.',exists:'No se pudo crear la cuenta. Si ya existe, entre con su contraseña.',net:'Sin conexión con el servicio de acceso.',enroll:'Membresía verificada',none:'Ninguna membresía asignada todavía. El programa la asigna desde License Admin.',pick:'Seleccione una membresía…',loading:'Cargando…',date:'Fecha de vigencia',stage:'Etapa de desarrollo',days:'Días por semana',stations:'Estaciones del plan',goals:'Las metas del Centro de metas se guardan en esta membresía mientras esté seleccionada.',goalSaved:'Meta guardada en la memoria del entrenador.',goalFail:'La meta quedó solo en esta sesión; no se pudo guardar en la memoria.',goalLoaded:'metas cargadas de la memoria del entrenador.',unavailable:'La memoria del entrenador no está activada todavía.'},
 en:{title:'Coach Memory',intro:'Individual plans and goals that persist between sessions. Requires your coach account and a verified enrollment assigned by the program.',email:'Email',password:'Password',signin:'Sign in',signup:'Create account',signout:'Sign out',signedin:'Coach session active',signedout:'No coach session',badlogin:'Wrong email or password.',created:'Account created. Check your email to confirm it, then ask the program to assign athletes to you.',exists:'Could not create the account. If it already exists, sign in with your password.',net:'No connection to the sign-in service.',enroll:'Verified enrollment',none:'No enrollment assigned yet. The program assigns it from License Admin.',pick:'Select an enrollment…',loading:'Loading…',date:'Effective date',stage:'Developmental stage',days:'Days per week',stations:'Plan stations',goals:'Goal Center goals are saved to this enrollment while it is selected.',goalSaved:'Goal saved to Coach Memory.',goalFail:'The goal stayed in this session only; it could not be saved to memory.',goalLoaded:'goals loaded from Coach Memory.',unavailable:'Coach Memory is not activated yet.'}
};
function T(k){return CM_TEXT[typeof LANG==='string'&&LANG==='en'?'en':'es'][k]}
var $=function(id){return document.getElementById(id)};
var mods=window.__coachMemoryModules;
if(!mods||!$('cm')||!$('gcAdd'))return;
/* ── Supabase Auth over REST (no persistent token outside this tab) ── */
var SESSION=null,authCb=null;
function sessionLoad(){try{var s=JSON.parse(sessionStorage.getItem('cm-session')||'null');if(s&&s.access_token&&Number(s.expires_at)*1000>Date.now())return s}catch(e){}return null}
function sessionSave(s){try{if(s)sessionStorage.setItem('cm-session',JSON.stringify({access_token:s.access_token,expires_at:s.expires_at,user:{id:s.user&&s.user.id,email:s.user&&s.user.email}}));else sessionStorage.removeItem('cm-session')}catch(e){}}
var auth={
 onAuthStateChange:function(fn){authCb=fn;return {data:{subscription:{unsubscribe:function(){authCb=null}}}}},
 getUser:function(token){return fetch(SB_URL+'/auth/v1/user',{headers:{apikey:SB_KEY,Authorization:'Bearer '+token},cache:'no-store'}).then(function(r){return r.ok?r.json().then(function(u){return {data:{user:u},error:null}}):{data:{user:null},error:Error('denied')}}).catch(function(e){return {data:{user:null},error:e}})}
};
function setSession(s,event){SESSION=s;sessionSave(s);if(authCb)authCb(event,s)}
function authPost(path,body,token){return fetch(SB_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+(token||SB_KEY),'Content-Type':'application/json'},body:JSON.stringify(body||{})})}
/* ── controller, panel, goal persistence ── */
var controller=mods.createAuthCoachMemory({auth:auth,endpoint:CM_ENDPOINT,enabled:true,onChange:onState});
var goals=mods.createGoalCenterPersistence({controller:controller});
var panel=null,ENROLLMENTS=[],listGen=0;
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function draft(){var st=[].slice.call(document.querySelectorAll('#cmStations input:checked')).map(function(i){return i.value});return st.length?{effectiveOn:$('cmDate').value||today(),stage:$('cmStage').value,days:Number($('cmDays').value),stations:st}:null}
function render(){
 var s=controller.state(),on=s.authenticated;
 $('cmTitle').textContent=T('title');$('cmIntro').textContent=T('intro');$('cmEmailL').textContent=T('email');$('cmPassL').textContent=T('password');$('cmSignin').textContent=T('signin');$('cmSignup').textContent=T('signup');$('cmSignout').textContent=T('signout');
 $('cmEnrollL').textContent=T('enroll');$('cmDateL').textContent=T('date');$('cmStageL').textContent=T('stage');$('cmDaysL').textContent=T('days');$('cmStationsL').textContent=T('stations');$('cmGoalNote').textContent=T('goals');
 $('cmAuthForm').hidden=on;$('cmSignout').hidden=!on;$('cmWho').textContent=on?T('signedin')+(SESSION&&SESSION.user&&SESSION.user.email?' · '+SESSION.user.email:''):T('signedout');
 $('cmWork').hidden=!on;$('cmDraft').hidden=!s.membershipId;$('cmGoalNote').hidden=!s.membershipId;
 var sel=$('cmEnroll');sel.innerHTML='<option value="">'+(ENROLLMENTS.length?T('pick'):T('none'))+'</option>'+ENROLLMENTS.map(function(e){return '<option value="'+esc(e.membership_id)+'">'+esc((e.label||e.membership_id.slice(0,8))+' · '+e.program_key)+'</option>'}).join('');sel.value=s.membershipId||'';
 if(panel)panel.setLanguage(LANG);
}
function onState(s){if(!s.authenticated){ENROLLMENTS=[];$('cmEnroll').value='';gcMemoryClear()}render()}
async function loadEnrollments(){var g=++listGen;$('cmAuthStatus').textContent=T('loading');
 try{var r=await controller.listEnrollments({pageSize:100});if(g!==listGen)return;ENROLLMENTS=r.enrollments;$('cmAuthStatus').textContent='';}
 catch(e){if(g!==listGen)return;ENROLLMENTS=[];$('cmAuthStatus').textContent=e&&e.code==='unavailable'?T('unavailable'):''}
 render();
}
async function signIn(){var email=$('cmEmail').value.trim(),pw=$('cmPass').value;if(!email||!pw)return;$('cmAuthStatus').textContent=T('loading');
 try{var r=await authPost('token?grant_type=password',{email:email,password:pw});if(!r.ok){$('cmAuthStatus').textContent=T('badlogin');return}var s=await r.json();$('cmPass').value='';setSession(s,'SIGNED_IN');$('cmAuthStatus').textContent='';setTimeout(loadEnrollments,50)}
 catch(e){$('cmAuthStatus').textContent=T('net')}
}
async function signUp(){var email=$('cmEmail').value.trim(),pw=$('cmPass').value;if(!email||pw.length<8){$('cmAuthStatus').textContent=T('exists');return}$('cmAuthStatus').textContent=T('loading');
 try{var r=await authPost('signup',{email:email,password:pw});$('cmAuthStatus').textContent=r.ok?T('created'):T('exists');if(r.ok)$('cmPass').value=''}catch(e){$('cmAuthStatus').textContent=T('net')}
}
function signOut(){var s=SESSION;if(s)authPost('logout',{},s.access_token).catch(function(){});setSession(null,'SIGNED_OUT');$('cmAuthStatus').textContent=''}
/* ── Goal Center bridge: goals persist to the selected enrollment ── */
var gcAddOriginal=$('gcAdd').onclick;
function gcMemoryClear(){var el=$('gcMemory');if(el)el.textContent=''}
$('gcAdd').onclick=function(){
 var before=(GC_GOALS.get(GC_KEY)||[]).slice();gcAddOriginal.apply(this,arguments);
 var after=GC_GOALS.get(GC_KEY)||[],added=after.find(function(g){return before.indexOf(g)<0});
 if(!added||!controller.state().membershipId||!goals.canPersist(added.metric))return;
 goals.save({metric:added.metric,target:added.target,effectiveOn:today()}).then(function(){$('gcMemory').textContent=T('goalSaved')}).catch(function(){$('gcMemory').textContent=T('goalFail')});
};
async function loadGoals(){if(!controller.state().membershipId||!GC_KEY)return;
 try{var r=await goals.load();if(!controller.state().membershipId)return;var cur=GC_GOALS.get(GC_KEY)||[];
  r.goals.forEach(function(g){var m=GC_METRICS.find(function(x){return x.id===g.id});if(!m)return;var i=cur.findIndex(function(x){return x.id===g.id});var goal={id:g.id,metric:m,start:g.start,target:g.target,recordId:g.recordId};if(i>=0)cur[i]=goal;else cur.push(goal)});
  GC_GOALS.set(GC_KEY,cur);gcRender();$('gcMemory').textContent=r.goals.length?r.goals.length+' '+T('goalLoaded'):''}
 catch(e){}
}
/* ── wiring ── */
$('cmSignin').onclick=signIn;$('cmSignup').onclick=signUp;$('cmSignout').onclick=signOut;
$('cmPass').addEventListener('keydown',function(e){if(e.key==='Enter')signIn()});
$('cmEnroll').onchange=function(){var id=$('cmEnroll').value||null;try{controller.select(id);goals.invalidate()}catch(e){return}render();if(panel)panel.refresh();gcMemoryClear();if(id){loadGoals();if(panel)panel.history()}};
$('cmDate').value=today();
panel=mods.mountCoachMemoryPanel({root:$('cmPanel'),controller:controller,getDraft:draft,language:LANG});
var lockOriginal=$('lockBtn').onclick;$('lockBtn').onclick=function(){signOut();$('cmEmail').value='';if(lockOriginal)return lockOriginal.apply(this,arguments)};
// a different athlete profile means a different pairing: the coach must pick the enrollment again
var apSel=$('apSelect'),apOriginal=apSel.onchange;apSel.onchange=function(){if(apOriginal)apOriginal.apply(this,arguments);gcMemoryClear();if(controller.state().membershipId){try{controller.select(null);goals.invalidate()}catch(e){}$('cmEnroll').value='';render();if(panel)panel.refresh()}};
document.querySelectorAll('#cvLang button').forEach(function(b){b.addEventListener('click',function(){setTimeout(render,0)})});
window.__coachMemory={controller:controller,goals:goals,state:function(){return controller.state()},enrollments:function(){return ENROLLMENTS.slice()}};
render();
var saved=sessionLoad();if(saved){setSession(saved,'SIGNED_IN');setTimeout(loadEnrollments,80)}
})();
