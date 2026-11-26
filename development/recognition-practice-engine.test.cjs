'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createRecognitionPractice}=require('./recognition-practice-engine.cjs');
const {createRecognitionBpmAdapter}=require('./recognition-bpm-adapter.cjs');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
function fixture(bpm=84){
 let t=0,serial=0;const jobs=new Map(),states=[];
 const host=createRecognitionPractice({now:()=>t,random:()=>0,schedule:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:t+ms});return id},cancel:id=>jobs.delete(id),onState:s=>states.push(s)});
 const adapter=createRecognitionBpmAdapter({host});
 const planId=randomUUID();
 function advance(ms){const end=t+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;t=next[1].at;jobs.delete(next[0]);next[1].fn()}t=end}
 function watch(){const start=states.length,n=host.snapshot().level;host.start();advance((2*n+1)*60000/bpm+0.0001);assert.equal(host.snapshot().phase,'finding');const rows=states.slice(start);const original=rows.filter(s=>s.phase==='watch'&&s.visible!==null).map(s=>s.visible),echo=rows.filter(s=>s.phase==='echo'&&s.visible!==null).map(s=>s.visible);assert.equal(original.length,n);assert.equal(echo.length,n);assert.equal(new Set(original).size,n);assert.equal(new Set(echo).size,n);assert.equal(original.filter((v,i)=>v!==echo[i]).length,1);const changed=echo.find(v=>!original.includes(v));assert.notEqual(changed,undefined);assert.deepEqual(host.snapshot().choices,echo);assert.ok(Object.isFrozen(host.snapshot().choices));return {original,echo,changed}}
 return {host,adapter,advance,watch,jobs,states,planId,configure:()=>adapter.apply({bpm,planId})};
}
(async()=>{
for(const bpm of [20,40,60,84,100,120]){
 const f=fixture(bpm);assert.throws(()=>f.host.start());f.configure();
 const timing=f.adapter.getTiming();assert.equal(timing.beatMs,60000/bpm);assert.equal(timing.flashMs,timing.beatMs*.55);assert.equal(timing.transitionMs,timing.beatMs);assert.equal(timing.responseMs,Math.round(timing.beatMs*10));assert.ok(Object.isFrozen(timing));
 f.host.start();assert.equal(f.host.snapshot().phase,'watch');assert.equal(f.host.tap(1),false);assert.throws(()=>f.configure());
 f.advance(timing.beatMs*.54);assert.notEqual(f.host.snapshot().visible,null);f.advance(timing.beatMs*.02);assert.equal(f.host.snapshot().visible,null);
 f.advance(timing.beatMs*4.45);assert.equal(f.host.snapshot().phase,'finding');assert.equal(f.host.snapshot().responseMs,timing.responseMs);
 f.advance(timing.responseMs);assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().rounds,1);assert.equal(f.host.snapshot().level,2);assert.equal(f.jobs.size,0);
}
const f=fixture();f.configure();
for(const bpm of [0,19,121,84.5,'84',null])assert.throws(()=>f.adapter.apply({bpm,planId:f.planId}));
assert.throws(()=>f.adapter.apply({bpm:84,planId:'bad'}));assert.throws(()=>createRecognitionBpmAdapter({host:{...f.host,mode:'competition'}}));
for(let i=0;i<27;i++){const {echo,changed}=f.watch();assert.equal(echo.length,Math.min(24,i+2));assert.equal(f.host.tap(-1),false);assert.equal(f.host.snapshot().phase,'finding');assert.equal(f.host.tap(changed),true);assert.equal(f.host.snapshot().phase,'correct');assert.equal(f.host.snapshot().level,Math.min(24,i+3));assert.equal(f.jobs.size,0)}
assert.equal(f.host.snapshot().correct,27);assert.equal(f.host.snapshot().rounds,27);
let {echo,changed}=f.watch();assert.equal(f.host.tap(echo.find(v=>v!==changed)),false);assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().level,23);
f.host.start();f.adapter.clear();assert.equal(f.host.snapshot().bpm,null);assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');
f.configure();f.watch();f.adapter.clear();assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');assert.equal(f.host.snapshot().rounds,0);
let selection={membershipId:randomUUID(),planId:f.planId,sessionEpoch:'one'};
const bridge=createBpmBridge({enabled:true,getSelection:()=>selection,programs:{recognition:f.adapter},client:{invalidate(){},async request(action,fields){assert.equal(action,'get_bpm_plan');assert.deepEqual(fields,{plan_id:selection.planId,station:'recognition'});return {prescription:{plan_id:selection.planId,membership_id:selection.membershipId,confirmation_id:randomUUID(),station:'recognition',bpm:84,effective_on:'2020-01-01',stage:'11-12'}}}}});
assert.equal((await bridge.launch('recognition')).bpm,84);f.host.start();selection={...selection,membershipId:randomUUID()};bridge.invalidate();assert.equal(f.host.snapshot().bpm,null);assert.equal(f.jobs.size,0);
console.log('PASS: Recognition personal BPM, single change, timing, 24-cell progression, repeated rounds, wrong response, timeout, cancellation and bridge integration');
})().catch(e=>{console.error(e);process.exitCode=1});
