'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAuthPersonalBpmHost}=require('./auth-personal-bpm-host.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const selection={membershipId:id(1),planId:id(2)};
const session=(n=3,seconds=60)=>({user:{id:id(n)},access_token:'a.b.c',expires_at:Date.now()/1000+seconds});
const tick=()=>new Promise(r=>setTimeout(r,20));
function fixture(enabled=true){
 let emit,verified={id:id(3),is_anonymous:false},calls=0,unsub=false,hold=null;
 const auth={onAuthStateChange(fn){emit=fn;return {data:{subscription:{unsubscribe(){unsub=true}}}}},async getUser(){return {data:{user:verified},error:null}}};
 const adapter=createAuthPersonalBpmHost({auth,enabled,endpoint:'https://example.com/v1/coach-memory',fetchImpl:async(url,opts)=>{
 calls++;const b=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer a.b.c');assert.equal(b.membership_id,selection.membershipId);
 if(hold)await hold;
 return {ok:true,json:async()=>({prescription:{membership_id:b.membership_id,plan_id:b.plan_id,station:b.station,bpm:84,confirmation_id:id(4),effective_on:'2026-01-01',stage:'9-10'}})};
 }});
 return {...adapter,emit,setUser:u=>verified=u,calls:()=>calls,unsub:()=>unsub,hold:p=>hold=p};
}
const request=f=>f.host.client.request('get_bpm_plan',{plan_id:selection.planId,station:'ritnome'});
test('disabled adapter does not establish session',async()=>{const f=fixture(false);try{f.emit('INITIAL_SESSION',session());await tick();assert.equal(f.getSession(),null);assert.throws(()=>f.host.select(selection));assert.equal(f.calls(),0)}finally{f.dispose()}});
test('verified identity and exact prescription',async()=>{const f=fixture();try{f.emit('SIGNED_IN',session());await tick();assert.equal(f.getSession().userId,id(3));f.host.select(selection);assert.equal((await request(f)).prescription.bpm,84);assert.equal(f.calls(),1)}finally{f.dispose()}});
test('anonymous and mismatched identities rejected',async()=>{const f=fixture();try{for(const u of [{id:id(3),is_anonymous:true},{id:id(5),is_anonymous:false}]){f.setUser(u);f.emit('SIGNED_IN',session());await tick();assert.equal(f.getSession(),null);assert.throws(()=>f.host.select(selection))}assert.equal(f.calls(),0)}finally{f.dispose()}});
test('logout invalidates selection synchronously',async()=>{const f=fixture();try{f.emit('SIGNED_IN',session());await tick();f.host.select(selection);f.emit('SIGNED_OUT',null);assert.equal(f.getSession(),null);assert.equal(f.host.getSelection(),null);await assert.rejects(request(f));assert.equal(f.calls(),0)}finally{f.dispose()}});
test('expired session rejected',async()=>{const f=fixture();try{f.emit('SIGNED_IN',session(3,-1));await tick();assert.equal(f.getSession(),null);f.emit('SIGNED_IN',session(3,0.08));await tick();f.host.select(selection);await new Promise(r=>setTimeout(r,100));assert.equal(f.getSession(),null);assert.equal(f.host.getSelection(),null)}finally{f.dispose()}});
test('refresh requires explicit reselection',async()=>{const f=fixture();try{f.emit('SIGNED_IN',session());await tick();f.host.select(selection);f.emit('TOKEN_REFRESHED',session());assert.equal(f.host.getSelection(),null);await tick();assert.equal(f.host.getSelection(),null);f.host.select(selection);assert.equal((await request(f)).prescription.bpm,84)}finally{f.dispose()}});
test('changed verified identity prevents transport',async()=>{const f=fixture();try{f.emit('SIGNED_IN',session());await tick();f.host.select(selection);f.setUser({id:id(5),is_anonymous:false});await assert.rejects(request(f));assert.equal(f.calls(),0);assert.equal(f.getSession(),null)}finally{f.dispose()}});
test('logout cancels in-flight prescription',async()=>{const f=fixture();let resolve;try{f.emit('SIGNED_IN',session());await tick();f.host.select(selection);f.hold(new Promise(r=>resolve=r));const p=request(f);await tick();assert.equal(f.calls(),1);f.emit('SIGNED_OUT',null);resolve();await assert.rejects(p)}finally{f.dispose()}});
test('dispose unsubscribes and rejects subsequent access',async()=>{const f=fixture();f.emit('SIGNED_IN',session());await tick();f.dispose();assert.equal(f.unsub(),true);assert.equal(f.getSession(),null);await assert.rejects(request(f))});
