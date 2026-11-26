'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthCoachMemory}=require('./auth-coach-memory.cjs');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',U='10000000-0000-4000-8000-000000000003',R='10000000-0000-4000-8000-000000000004';
const plan={requestId:R,effectiveOn:'2026-11-26',stage:'11-12',days:3,stations:['fortress','recall']};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(t,{enabled=true,fetchImpl}={}){
 let callback,revoked=false,anonymous=false,unsubscribed=false;const calls=[];
 const auth={onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}},async getUser(){return revoked?{data:{user:null},error:Error('revoked')}:{data:{user:{id:U,is_anonymous:anonymous}},error:null}}};
 const c=createAuthCoachMemory({auth,enabled,endpoint:'https://example.invalid/v1/coach-memory',fetchImpl:async(url,o)=>{calls.push(JSON.parse(o.body));return fetchImpl?fetchImpl(url,o):{ok:true,json:async()=>calls.at(-1).action==='read'?{records:[{id:R}]}:{id:R}}}});
 t.after(()=>c.dispose());
 const event=(type='SIGNED_IN',expiry=Math.floor(Date.now()/1000)+120)=>callback(type,type==='SIGNED_OUT'?null:{access_token:'synthetic.test.token',expires_at:expiry,user:{id:U}});
 async function signIn(){event();for(let i=0;i<100&&!c.state().authenticated;i++)await delay(5);assert.equal(c.state().authenticated,true)}
 return {c,calls,event,signIn,revoke:()=>{revoked=true},anonymous:()=>{anonymous=true},unsubscribed:()=>unsubscribed};
}
test('disabled controller never transports or authenticates',async t=>{const f=fixture(t,{enabled:false});f.event();await delay(15);assert.equal(f.c.state().authenticated,false);await assert.rejects(f.c.history(),{code:'disabled'});assert.equal(f.calls.length,0)});
test('requires verified identity and selected membership',async t=>{const f=fixture(t);assert.throws(()=>f.c.select(A),{code:'authentication_required'});await f.signIn();await assert.rejects(f.c.history(),{code:'authentication_required'});assert.equal(f.calls.length,0)});
test('save is scoped and uses null BPM; retry retains request identity',async t=>{const f=fixture(t);await f.signIn();f.c.select(A);assert.deepEqual(await f.c.savePlan(plan),{id:R});await f.c.savePlan(plan);assert.deepEqual(f.calls[0],{action:'save_plan',membership_id:A,request_id:R,effective_on:plan.effectiveOn,plan:{stage:plan.stage,days:3,stations:plan.stations,bpm:null}});assert.deepEqual(f.calls[0],f.calls[1])});
test('history pagination and membership switching',async t=>{const f=fixture(t);await f.signIn();f.c.select(A);assert.deepEqual(await f.c.history(),{records:[{id:R}]});f.c.select(B);await f.c.history({pageSize:10,beforeTime:'2026-11-26T12:00:00Z',beforeId:R});assert.deepEqual(f.calls[1],{action:'read',membership_id:B,page_size:10,before_time:'2026-11-26T12:00:00Z',before_id:R})});
test('invalid plans and cursors never reach network',async t=>{const f=fixture(t);await f.signIn();f.c.select(A);for(const p of [{days:0},{stage:'unknown'},{stations:['recall','recall']},{stations:['unknown']},{requestId:'bad'}])await assert.rejects(f.c.savePlan({...plan,...p}),{code:'invalid_request'});await assert.rejects(f.c.history({beforeId:R}),{code:'invalid_request'});assert.equal(f.calls.length,0)});
test('server denial is preserved',async t=>{const f=fixture(t,{fetchImpl:async()=>({ok:false,status:403})});await f.signIn();f.c.select(A);await assert.rejects(f.c.history(),{code:'forbidden'})});
test('revoked credentials clear selection before transport',async t=>{const f=fixture(t);await f.signIn();f.c.select(A);f.revoke();await assert.rejects(f.c.history());assert.equal(f.c.state().authenticated,false);assert.equal(f.c.state().membershipId,null);assert.equal(f.calls.length,0)});
test('anonymous identity is rejected',async t=>{const f=fixture(t);f.anonymous();f.event();await delay(20);assert.equal(f.c.state().authenticated,false);assert.equal(f.calls.length,0)});
test('expired session cannot select',async t=>{const f=fixture(t);f.event('SIGNED_IN',Math.floor(Date.now()/1000)-1);await delay(20);assert.throws(()=>f.c.select(A),{code:'authentication_required'})});
for(const change of ['switch','logout','dispose'])test('pending history cannot cross '+change,async t=>{let resolve,started;const ready=new Promise(r=>started=r);const f=fixture(t,{fetchImpl:()=>{started();return new Promise(r=>resolve=r)}});await f.signIn();f.c.select(A);const pending=f.c.history();await ready;if(change==='switch')f.c.select(B);else if(change==='logout')f.event('SIGNED_OUT');else f.c.dispose();resolve({ok:true,json:async()=>({records:[{id:R}]})});await assert.rejects(pending,{code:'selection_changed'});if(change==='dispose')assert.equal(f.unsubscribed(),true)});

test('goal save uses verified membership and rejects invalid goal data',async t=>{const f=fixture(t);await f.signIn();f.c.select(A);const g={requestId:R,effectiveOn:'2026-11-26',metric:'active_days',baseline:2,target:4};assert.deepEqual(await f.c.saveGoal(g),{id:R});assert.deepEqual(f.calls[0],{action:'save_goal',membership_id:A,request_id:R,effective_on:g.effectiveOn,goal:{metric:g.metric,baseline:2,target:4}});for(const p of [{target:8},{metric:'unknown'},{baseline:-1},{target:2}])await assert.rejects(f.c.saveGoal({...g,...p}),{code:'invalid_request'});assert.equal(f.calls.length,1);f.event('SIGNED_OUT');await assert.rejects(f.c.saveGoal(g));assert.equal(f.calls.length,1)});
