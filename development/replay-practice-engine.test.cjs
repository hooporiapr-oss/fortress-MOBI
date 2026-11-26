'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createReplayPractice}=require('./replay-practice-engine.cjs');
const {createReplayBpmAdapter}=require('./replay-bpm-adapter.cjs');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
function fixture(bpm=84,opts={}){
 let t=0,serial=0;const jobs=new Map(),states=[];
 const host=createReplayPractice({now:()=>t,random:()=>0,schedule:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:t+ms});return id},cancel:id=>jobs.delete(id),onState:s=>states.push(s),...opts});
 const adapter=createReplayBpmAdapter({host});const planId=randomUUID();
 function advance(ms){const end=t+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;t=next[1].at;jobs.delete(next[0]);next[1].fn()}t=end}
 function watch(){const from=states.length;host.start();const n=host.snapshot().level;advance(n*60000/bpm+0.0001);assert.equal(host.snapshot().phase,'respond');const flashes=states.slice(from).filter(s=>s.phase==='watch'&&s.visible!==null);assert.equal(flashes.length,n);assert.deepEqual(flashes.map(s=>s.ordinal),Array.from({length:n},(_,i)=>i+1));return flashes.map(s=>s.visible)}
 return {host,adapter,advance,watch,jobs,states,planId,configure:()=>adapter.apply({bpm,planId})};
}
(async()=>{
for(const bpm of [20,40,60,84,100,120]){
 const f=fixture(bpm);assert.throws(()=>f.host.start());f.configure();
 const t=f.adapter.getTiming();assert.equal(t.beatMs,60000/bpm);assert.equal(t.flashMs,t.beatMs*520/700);assert.equal(t.responseMs,Math.round(t.beatMs*10));assert.ok(Object.isFrozen(t));
 f.host.start();assert.equal(f.host.snapshot().phase,'watch');assert.equal(f.host.tap(1),false);assert.throws(()=>f.configure());
 f.advance(t.beatMs*.74);assert.notEqual(f.host.snapshot().visible,null);f.advance(t.beatMs*.01);assert.equal(f.host.snapshot().visible,null);
 f.advance(t.beatMs*1.26);assert.equal(f.host.snapshot().phase,'respond');assert.equal(f.host.snapshot().responseMs,t.responseMs);
 f.advance(t.responseMs);assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().rounds,1);assert.equal(f.host.snapshot().correct,0);assert.equal(f.jobs.size,0);
}
const f=fixture();f.configure();
for(const bpm of [0,19,121,84.5,'84',null])assert.throws(()=>f.adapter.apply({bpm,planId:f.planId}));
assert.throws(()=>f.adapter.apply({bpm:84,planId:'bad'}));
assert.throws(()=>createReplayBpmAdapter({host:{...f.host,mode:'competition'}}));
assert.throws(()=>createReplayPractice({startLength:26}));assert.throws(()=>createReplayPractice({maxLength:1}));
let prior=[];
for(let i=0;i<28;i++){
 const chain=f.watch(),expected=2+i%24;assert.equal(chain.length,expected);
 if(expected>2){assert.deepEqual(chain.slice(0,-1),prior);assert.equal(chain.at(-1),0)}
 if(expected>=4)assert.ok(new Set(chain).size<chain.length);
 assert.equal(f.host.tap(-1),false);assert.equal(f.host.snapshot().phase,'respond');
 for(const cell of chain)assert.equal(f.host.tap(cell),true);
 assert.equal(f.host.snapshot().phase,'correct');assert.equal(f.jobs.size,0);prior=chain;
}
assert.equal(f.host.snapshot().rounds,28);assert.equal(f.host.snapshot().correct,28);assert.equal(f.host.snapshot().best,25);
let chain=f.watch();assert.equal(f.host.tap((chain[0]+1)%25),false);assert.equal(f.host.snapshot().phase,'retry');
chain=f.watch();assert.equal(chain.length,2);assert.equal(f.host.snapshot().best,25);
f.adapter.clear();assert.equal(f.jobs.size,0);assert.equal(f.host.snapshot().bpm,null);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');assert.equal(f.host.snapshot().best,0);
f.configure();f.host.start();f.adapter.clear();assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');
const short=fixture(84,{startLength:1,maxLength:3});short.configure();for(const n of [1,2,3,1]){const c=short.watch();assert.equal(c.length,n);for(const v of c)assert.equal(short.host.tap(v),true)}short.adapter.clear();
let selected={membershipId:randomUUID(),planId:f.planId,sessionEpoch:'one'};
const bridge=createBpmBridge({enabled:true,getSelection:()=>selected,programs:{replay:f.adapter},client:{invalidate(){},async request(action,fields){assert.equal(action,'get_bpm_plan');assert.deepEqual(fields,{plan_id:selected.planId,station:'replay'});return {prescription:{plan_id:selected.planId,membership_id:selected.membershipId,confirmation_id:randomUUID(),station:'replay',bpm:84,effective_on:'2020-01-01',stage:'11-12'}}}}});
assert.equal((await bridge.launch('replay')).bpm,84);f.host.start();selected={...selected,membershipId:randomUUID()};bridge.invalidate();assert.equal(f.jobs.size,0);assert.equal(f.host.snapshot().bpm,null);
console.log('PASS: Replay personal BPM, expanding chain prefix, repeated positions, maximum reset, best chain, timeout, cancellation and bridge integration');
})().catch(e=>{console.error(e);process.exitCode=1});
