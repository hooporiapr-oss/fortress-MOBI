'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createAuthenticatedRecognition}=require('./authenticated-recognition.cjs');
function fixture(enabled=true){
 let selected={membershipId:randomUUID(),planId:randomUUID(),sessionEpoch:'session-1'},listener=null,requests=0,unsubscribed=false;
 let response=()=>Promise.resolve({prescription:{plan_id:selected.planId,membership_id:selected.membershipId,confirmation_id:randomUUID(),effective_on:'2020-01-01',bpm:84,station:'recognition',stage:'11-12'}});
 const jobs=new Map();let serial=0;
 const controller=createAuthenticatedRecognition({enabled,getSelection:()=>selected,subscribeSelection(fn){listener=fn;return ()=>{listener=null;unsubscribed=true}},client:{invalidate(){},request(action,params){requests++;assert.equal(action,'get_bpm_plan');assert.equal(params.station,'recognition');assert.equal(params.plan_id,selected.planId);return response()}},engineOptions:{schedule(fn,ms){jobs.set(++serial,{fn,ms});return serial},cancel(id){jobs.delete(id)}}});
 return {controller,jobs,selection:()=>selected,change(s,notify=true){selected=s;if(notify)listener?.()},respond(fn){response=fn},requests:()=>requests,unsubscribed:()=>unsubscribed};
}
(async()=>{
 const disabled=fixture(false);await assert.rejects(disabled.controller.launch(),{code:'disabled'});assert.equal(disabled.requests(),0);disabled.controller.dispose();
 const f=fixture();const c=f.controller;
 assert.throws(()=>c.start(),{code:'selection_required'});
 assert.equal((await c.launch()).bpm,84);assert.equal(c.snapshot().bpm,84);assert.equal(c.snapshot().phase,'idle');
 c.start();assert.equal(c.snapshot().phase,'watch');assert.ok(f.jobs.size>0);
 f.change({...f.selection(),membershipId:randomUUID(),planId:randomUUID()});assert.equal(c.snapshot().bpm,null);assert.equal(f.jobs.size,0);assert.throws(()=>c.tap(1),{code:'selection_required'});
 await c.launch();c.start();f.change(null);assert.equal(f.jobs.size,0);assert.equal(c.snapshot().bpm,null);await assert.rejects(c.launch());
 f.change({membershipId:randomUUID(),planId:randomUUID(),sessionEpoch:'new'});
 f.respond(()=>Promise.reject(Object.assign(Error('Unauthorized'),{code:'unauthorized'})));await assert.rejects(c.launch(),{code:'unauthorized'});assert.equal(c.snapshot().bpm,null);assert.throws(()=>c.start());
 for(const payload of [{bpm:84,station:'replay'},{bpm:null,station:'recognition'},{bpm:121,station:'recognition'}]){
  f.respond(async()=>({prescription:{plan_id:f.selection().planId,membership_id:f.selection().membershipId,confirmation_id:randomUUID(),effective_on:'2020-01-01',stage:'11-12',...payload}}));await assert.rejects(c.launch(),{code:'incompatible_prescription'});assert.equal(c.snapshot().bpm,null);
 }
 const record={plan_id:f.selection().planId,membership_id:f.selection().membershipId,confirmation_id:randomUUID(),effective_on:'2020-01-01',bpm:84,station:'recognition',stage:'11-12'};
 f.respond(async()=>({prescription:{...record,membership_id:randomUUID()}}));await assert.rejects(c.launch(),{code:'prescription_unavailable'});
 let resolve;f.respond(()=>new Promise(r=>{resolve=r}));const pending=c.launch();f.change({...f.selection(),sessionEpoch:'next'});resolve({prescription:record});await assert.rejects(pending,{code:'selection_changed'});assert.equal(c.snapshot().bpm,null);
 f.respond(async()=>({prescription:record}));await c.launch();f.change({...f.selection(),sessionEpoch:'silent'},false);assert.throws(()=>c.start(),{code:'selection_required'});assert.equal(c.snapshot().bpm,null);
 await c.launch();c.start();c.stop();assert.equal(c.snapshot().bpm,null);assert.equal(f.jobs.size,0);
 await c.launch();c.dispose();assert.equal(f.unsubscribed(),true);assert.equal(c.snapshot().bpm,null);await assert.rejects(c.launch(),{code:'disabled'});
 console.log('PASS: authenticated Recognition disabled default, denied reads, invalid plans, delayed responses, athlete switch, logout and disposal');
})().catch(e=>{console.error(e);process.exitCode=1});
