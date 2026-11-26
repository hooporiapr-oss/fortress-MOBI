// Coach Memory inside Coach View: named coach sign-in, verified enrollments, saved plans/history,
// and persistent goals through the existing Goal Center. Loaded by coach.html after its own script.
// Nothing here matches athletes by name: the coach picks the enrollment and the athlete profile separately.
(function(){
'use strict';
var CM_ENDPOINT='https://hooporia-server.onrender.com/v1/coach-memory';
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
