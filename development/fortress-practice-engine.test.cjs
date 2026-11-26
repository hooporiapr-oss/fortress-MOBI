'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createFortressPractice}=require('./fortress-practice-engine.cjs');
const {createFortressBpmAdapter}=require('./fortress-bpm-adapter.cjs');
const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
function fixture(bpm=84,opts={}){
 let t=0,serial=0;const jobs=new Map(),states=[];
 const host=createFortressPractice({now:()=>t,random:()=>0,schedule:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:t+ms});return id},cancel:id=>jobs.delete(id),onState:s=>states.push(s),...opts});
 const adapter=createFortressBpmAdapter({host}),planId=randomUUID();
 function advance(ms){const end=t+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;t=next[1].at;jobs.delete(next[0]);next[1].fn()}t=end}
 function watch(){const from=states.length;host.start();const n=host.snapshot().level;advance(n*60000/bpm*.75+.0001);assert.equal(host.snapshot().phase,'respond');const flashes=states.slice(from).filter(s=>s.phase==='watch'&&s.visible!==null);assert.equal(flashes.length,n);assert.deepEqual(flashes.map(s=>s.ordinal),Array.from({length:n},(_,i)=>i+1));const chain=flashes.map(s=>s.visible);assert.ok(chain.every((v,i)=>Number.isInteger(v)&&v>=0&&v<5&&(i===0||v!==chain[i-1])));return chain}
 return {host,adapter,advance,watch,jobs,planId,configure:()=>adapter.apply({bpm,planId})};
}
(async()=>{
 for(const bpm of [20,40,60,84,100,120]){
  const f=fixture(bpm);assert.throws(()=>f.host.start());f.configure();
  const t=f.adapter.getTiming();assert.equal(t.beatMs,60000/bpm);assert.equal(t.stepMs,t.beatMs*.75);assert.equal(t.flashMs,t.beatMs*.5);assert.equal(t.responseMs,Math.round(t.beatMs*10));assert.ok(Object.isFrozen(t));
  f.host.start();assert.equal(f.host.snapshot().phase,'watch');assert.equal(f.host.tap(0),false);assert.throws(()=>f.configure());
  f.advance(t.beatMs*.49);assert.notEqual(f.host.snapshot().visible,null);
  f.advance(t.beatMs*.02);assert.equal(f.host.snapshot().visible,null);
  f.advance(t.beatMs*.25);assert.equal(f.host.snapshot().phase,'respond');assert.equal(f.host.snapshot().responseMs,t.responseMs);
  f.advance(t.responseMs);assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().rounds,1);assert.equal(f.jobs.size,0);
 }
 const f=fixture();f.configure();
 for(const bpm of [0,19,121,84.5,'84',null])assert.throws(()=>f.adapter.apply({bpm,planId:f.planId}));
 assert.throws(()=>f.adapter.apply({bpm:84,planId:'bad'}));
 assert.throws(()=>createFortressBpmAdapter({host:{...f.host,mode:'competition'}}));
 assert.throws(()=>createFortressPractice({startLength:26}));assert.throws(()=>createFortressPractice({maxLength:0}));
 let previous=[];
 for(let i=0;i<28;i++){
  const chain=f.watch(),expected=1+i%25;assert.equal(chain.length,expected);
  if(expected>1)assert.deepEqual(chain.slice(0,-1),previous);
  assert.equal(f.host.tap(5),false);assert.equal(f.host.snapshot().phase,'respond');
  for(const ball of chain)assert.equal(f.host.tap(ball),true);
  assert.equal(f.host.snapshot().phase,'correct');assert.equal(f.jobs.size,0);previous=chain;
 }
 assert.equal(f.host.snapshot().correct,28);assert.equal(f.host.snapshot().rounds,28);assert.equal(f.host.snapshot().best,25);
 let chain=f.watch();assert.equal(f.host.tap((chain[0]+1)%5),false);assert.equal(f.host.snapshot().phase,'retry');
 chain=f.watch();assert.equal(chain.length,1);assert.equal(f.host.snapshot().best,25);
 f.adapter.clear();assert.equal(f.host.snapshot().bpm,null);assert.equal(f.host.snapshot().best,0);assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');
 f.configure();f.host.start();f.adapter.clear();assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');
 const short=fixture(84,{startLength:3,maxLength:5,random:()=>.999});short.configure();for(const n of [3,4,5,3]){const c=short.watch();assert.equal(c.length,n);for(const v of c)assert.equal(short.host.tap(v),true)}short.adapter.clear();
 let selected={membershipId:randomUUID(),planId:f.planId,sessionEpoch:'one'};
 const bridge=createBpmBridge({enabled:true,getSelection:()=>selected,programs:{fortress:f.adapter},client:{invalidate(){},async request(action,fields){assert.equal(action,'get_bpm_plan');assert.deepEqual(fields,{plan_id:selected.planId,station:'fortress'});return {prescription:{plan_id:selected.planId,membership_id:selected.membershipId,confirmation_id:randomUUID(),station:'fortress',bpm:84,effective_on:'2020-01-01',stage:'11-12'}}}}});
 assert.equal((await bridge.launch('fortress')).bpm,84);f.host.start();selected={...selected,membershipId:randomUUID()};bridge.invalidate();assert.equal(f.jobs.size,0);assert.equal(f.host.snapshot().bpm,null);
 console.log('PASS: Fortress personal BPM, five-ball range, no consecutive repetitions, expanding prefix, 25-step limit, timeout, cancellation and bridge integration');
})().catch(e=>{console.error(e);process.exitCode=1});
