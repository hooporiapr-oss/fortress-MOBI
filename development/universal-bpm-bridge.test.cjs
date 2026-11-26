'use strict';
const assert=require('node:assert/strict');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
const {randomUUID}=require('node:crypto');
function fixture(opts={}){
 let selected={membershipId:randomUUID(),planId:randomUUID(),sessionEpoch:'one'};
 let records=[{id:selected.planId,kind:'training_plan',effective_on:'2020-01-01',payload:{bpm:84,stations:['recall']}}];
 let applied=null,clears=0,reads=0;
 const client={invalidate(){},async request(action,fields){reads++;assert.equal(action,'read');assert.equal(fields.page_size,100);return {records}}};
 const programs={recall:{min:20,max:120,station:'recall',apply(c){applied=c},clear(){clears++;applied=null}}};
 const bridge=createBpmBridge({client,programs,getSelection:()=>selected,enabled:true,...opts});
 return {bridge,client,programs,get records(){return records},set records(r){records=r},get selected(){return selected},set selected(s){selected=s},get applied(){return applied},get clears(){return clears},get reads(){return reads}};
}
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);
(async()=>{
 let f=fixture();assert.equal((await f.bridge.launch('recall')).bpm,84);assert.equal(f.applied.planId,f.selected.planId);assert.ok(Object.isFrozen(f.applied));
 f.bridge.invalidate();assert.equal(f.applied,null);
 f=fixture({enabled:false});await rejects(f.bridge.launch('recall'),'disabled');assert.equal(f.reads,0);
 f=fixture();await rejects(f.bridge.launch('unknown'),'unsupported_program');assert.equal(f.reads,0);
 f=fixture();f.records=[];await rejects(f.bridge.launch('recall'),'prescription_unavailable');assert.equal(f.applied,null);
 for(const bpm of [null,0,121,84.5,'84']){f=fixture();f.records[0].payload.bpm=bpm;await rejects(f.bridge.launch('recall'),'incompatible_prescription');assert.equal(f.applied,null)}
 f=fixture();f.records[0].payload.stations=['replay'];await rejects(f.bridge.launch('recall'),'incompatible_prescription');
 f=fixture();f.records[0].effective_on='2999-01-01';await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.records.push({id:randomUUID(),kind:'correction',supersedes_id:f.selected.planId});await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.records.push({...f.records[0]});await rejects(f.bridge.launch('recall'),'prescription_unavailable');
 f=fixture();f.client.request=async()=>{throw Object.assign(Error('expired'),{code:'authentication_required'})};await rejects(f.bridge.launch('recall'),'authentication_required');assert.equal(f.applied,null);
 f=fixture();let release;f.client.request=()=>new Promise(r=>{release=r});let pending=f.bridge.launch('recall');f.selected={...f.selected,membershipId:randomUUID()};f.bridge.invalidate();release({records:f.records});await rejects(pending,'selection_changed');assert.equal(f.applied,null);
 f=fixture();f.client.request=()=>new Promise(r=>{release=r});pending=f.bridge.launch('recall');f.selected={...f.selected,sessionEpoch:'two'};release({records:f.records});await rejects(pending,'selection_changed');assert.equal(f.applied,null);
 console.log('PASS: exact prescription BPM, compatibility, no fallback, duplicate and superseded records, disabled activation, expired auth, stale athlete and session responses');
})().catch(e=>{console.error(e);process.exitCode=1});
