'use strict';
const assert=require('node:assert/strict');
const {createRecallBpmAdapter}=require('./recall-bpm-adapter.cjs');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
const {randomUUID}=require('node:crypto');
(async()=>{
 let timing=null,idle=true,cancelled=0,cleared=0;
 const host={mode:'personalized_practice',isIdle:()=>idle,configureTiming(t){timing=t},cancelPractice(){cancelled++;idle=true},clearTiming(){cleared++;timing=null}};
 const adapter=createRecallBpmAdapter({host});
 const planId=randomUUID();
 for(const bpm of [20,60,84,100,120]){
  adapter.apply({bpm,planId});assert.equal(timing.beatMs,60000/bpm);assert.equal(timing.responseMs,Math.round(600000/bpm));assert.equal(timing.scoring,'practice_only');assert.equal(timing.planId,planId);assert.ok(Object.isFrozen(timing));assert.equal(adapter.getTiming(),timing);adapter.clear();assert.equal(timing,null);assert.equal(adapter.getTiming(),null);
 }
 for(const bpm of [0,19,121,84.5,'84',null])assert.throws(()=>adapter.apply({bpm,planId}));
 assert.throws(()=>adapter.apply({bpm:84,planId:'bad'}));
 idle=false;assert.throws(()=>adapter.apply({bpm:84,planId}));adapter.clear();assert.equal(idle,true);
 assert.throws(()=>createRecallBpmAdapter({host:{...host,mode:'competition'}}));
 assert.throws(()=>createRecallBpmAdapter({host,min:120,max:20}));
 const broken=createRecallBpmAdapter({host:{...host,configureTiming(){throw Error('failure')}}});
 assert.throws(()=>broken.apply({bpm:84,planId}));assert.equal(broken.getTiming(),null);assert.equal(timing,null);
 let selected={membershipId:randomUUID(),planId,sessionEpoch:'one'};
 const client={invalidate(){},async request(){return {prescription:{plan_id:planId,membership_id:selected.membershipId,confirmation_id:randomUUID(),effective_on:'2020-01-01',bpm:84,station:'recall',stage:'11-12'}}}};
 const bridge=createBpmBridge({client,getSelection:()=>selected,programs:{recall:adapter},enabled:true});
 assert.equal((await bridge.launch('recall')).bpm,84);assert.equal(timing.responseMs,7143);
 idle=false;selected={...selected,membershipId:randomUUID()};bridge.invalidate();assert.equal(timing,null);assert.equal(idle,true);assert.ok(cancelled>=7);assert.equal(cancelled,cleared);
 console.log('PASS: Recall timing, limits, isolated practice, idle guard, failure cleanup, bridge integration and athlete switching');
})().catch(e=>{console.error(e);process.exitCode=1});
