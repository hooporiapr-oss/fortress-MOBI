'use strict';
const assert=require('node:assert/strict');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
const {randomUUID}=require('node:crypto');
function fixture(opts={}){
 let selected={membershipId:randomUUID(),planId:randomUUID(),sessionEpoch:'one'};
 let prescription={plan_id:selected.planId,membership_id:selected.membershipId,confirmation_id:randomUUID(),effective_on:'2020-01-01',bpm:84,station:'recall',stage:'11-12'};
 let applied=null,clears=0,reads=0;
 const client={invalidate(){},async request(action,fields){reads++;assert.equal(action,'get_bpm_plan');assert.deepEqual(fields,{plan_id:selected.planId,station:'recall'});return {prescription}}};
 const programs={recall:{min:20,max:120,station:'recall',apply(c){applied=c},clear(){clears++;applied=null}}};
 const bridge=createBpmBridge({client,programs,getSelection:()=>selected,enabled:true,...opts});
 return {bridge,client,programs,get prescription(){return prescription},set prescription(r){prescription=r},get selected(){return selected},set selected(s){selected=s},get applied(){return applied},get clears(){return clears},get reads(){return reads}};
}
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);
(async()=>{
 let f=fixture();assert.equal((await f.bridge.launch('recall')).bpm,84);assert.equal(f.applied.planId,f.selected.planId);assert.ok(Object.isFrozen(f.applied));
 f.bridge.invalidate();assert.equal(f.applied,null);
 f=fixture({enabled:false});await rejects(f.bridge.launch('recall'),'disabled');assert.equal(f.reads,0);
 f=fixture();await rejects(f.bridge.launch('unknown'),'unsupported_program');assert.equal(f.reads,0);
 f=fixture();f.prescription=null;await rejects(f.bridge.launch('recall'),'prescription_unavailable');assert.equal(f.applied,null);
 for(const bpm of [null,0,121,84.5,'84']){f=fixture();f.prescription.bpm=bpm;await rejects(f.bridge.launch('recall'),'incompatible_prescription');assert.equal(f.applied,null)}
 f=fixture();f.prescription.station='replay';await rejects(f.bridge.launch('recall'),'incompatible_prescription');
 f=fixture();f.prescription.effective_on='2999-01-01';await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.prescription.membership_id=randomUUID();await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.prescription.confirmation_id=null;await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.client.request=async()=>{throw Object.assign(Error('expired'),{code:'authentication_required'})};await rejects(f.bridge.launch('recall'),'authentication_required');assert.equal(f.applied,null);
 f=fixture();let release;f.client.request=()=>new Promise(r=>{release=r});let pending=f.bridge.launch('recall');f.selected={...f.selected,membershipId:randomUUID()};f.bridge.invalidate();release({prescription:f.prescription});await rejects(pending,'selection_changed');assert.equal(f.applied,null);
 f=fixture();f.client.request=()=>new Promise(r=>{release=r});pending=f.bridge.launch('recall');f.selected={...f.selected,sessionEpoch:'two'};release({prescription:f.prescription});await rejects(pending,'selection_changed');assert.equal(f.applied,null);
 console.log('PASS: exact prescription BPM, compatibility, no fallback, mismatched membership and missing confirmation, disabled activation, expired auth, stale athlete and session responses');
})().catch(e=>{console.error(e);process.exitCode=1});
