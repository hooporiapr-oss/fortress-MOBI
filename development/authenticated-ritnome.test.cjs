'use strict';
const assert=require('node:assert/strict');
const {createAuthenticatedRitnome}=require('./authenticated-ritnome.cjs');
const {createRitnomeClock}=require('./ritnome-clock.cjs');
const m='00000000-0000-4000-8000-000000000001',p='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
function fixture(enabled=true){
 let selection={membershipId:m,planId:p,sessionEpoch:'one'},listener,invalidations=0,cancelled=0,unsubscribed=false,answer={membership_id:m,plan_id:p,confirmation_id:c,bpm:84,station:'ritnome',effective_on:'2020-01-01',stage:'11-12'},pending=null;
 const clock=createRitnomeClock({audio:{prepare(){},scheduleStep(){},cancel(){cancelled++}},now:()=>0,interval:()=>1,clear:()=>{}});
 const client={invalidate(){invalidations++},async request(action,fields){assert.equal(action,'get_bpm_plan');assert.deepEqual(fields,{plan_id:p,station:'ritnome'});if(pending)await pending;return {prescription:answer}}};
 const controller=createAuthenticatedRitnome({clock,client,getSelection:()=>selection,subscribeSelection(fn){listener=fn;return ()=>{unsubscribed=true;listener=null}},enabled});
 return {controller,clock,change(s,notify=true){selection=s;if(notify)listener?.()},answer(v){answer={...answer,...v}},delay(v){pending=v},get cancelled(){return cancelled},get unsubscribed(){return unsubscribed},get invalidations(){return invalidations}};
}
(async()=>{
 const disabled=fixture(false);await assert.rejects(disabled.controller.launch(),{code:'disabled'});
 const f=fixture();assert.throws(()=>f.controller.start(),{code:'selection_required'});
 assert.deepEqual(await f.controller.launch(),{bpm:84,source:'personal'});f.controller.start(30);assert.equal(f.clock.snapshot().state,'running');assert.equal(f.clock.snapshot().bpm,84);
 f.change(null);assert.equal(f.clock.snapshot().state,'idle');assert.equal(f.clock.snapshot().bpm,null);assert.ok(f.cancelled>0);assert.throws(()=>f.controller.start());
 for(const v of [{bpm:39},{bpm:201},{bpm:84.5},{stage:'5-6'},{stage:'7-8'},{station:'recall'},{membership_id:c},{plan_id:c},{confirmation_id:'bad'},{effective_on:'9999-01-01'}]){
 const g=fixture();g.answer(v);await assert.rejects(g.controller.launch(),{code:'incompatible_prescription'});assert.equal(g.clock.snapshot().bpm,null);
 }
 const race=fixture();let release;race.delay(new Promise(r=>release=r));const launch=race.controller.launch();race.change(null);release();await assert.rejects(launch,{code:'selection_changed'});assert.equal(race.clock.snapshot().bpm,null);
 const silent=fixture();await silent.controller.launch();silent.change(null,false);assert.throws(()=>silent.controller.start(),{code:'selection_required'});
 const stop=fixture();await stop.controller.launch();stop.controller.start(null);stop.controller.stop();assert.equal(stop.clock.snapshot().bpm,null);assert.equal(stop.clock.snapshot().state,'idle');
 stop.controller.dispose();assert.equal(stop.unsubscribed,true);await assert.rejects(stop.controller.launch(),{code:'disabled'});
 console.log('PASS: scoped Ritnome prescription, age and range guard, stale selection, cancellation and disposal');
})().catch(e=>{console.error(e);process.exitCode=1});
