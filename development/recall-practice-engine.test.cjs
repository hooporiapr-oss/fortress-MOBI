'use strict';
const assert=require('node:assert/strict');
const {createRecallPractice}=require('./recall-practice-engine.cjs');
const {createRecallBpmAdapter}=require('./recall-bpm-adapter.cjs');
const {randomUUID}=require('node:crypto');
function fixture(bpm=84){
 let t=0,serial=0;const jobs=new Map(),states=[];
 const host=createRecallPractice({now:()=>t,random:()=>0,schedule:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:t+ms});return id},cancel:id=>jobs.delete(id),onState:s=>states.push(s)});
 const adapter=createRecallBpmAdapter({host});
 function advance(ms){const end=t+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;t=next[1].at;jobs.delete(next[0]);next[1].fn()}t=end}
 function watch(){const start=states.length;host.start();const n=host.snapshot().level;advance(n*60000/bpm+0.00001);assert.equal(host.snapshot().phase,'respond');return states.slice(start).filter(s=>s.phase==='watch'&&s.visible!==null).map(s=>s.visible)}
 return {host,adapter,advance,watch,jobs,states,configure:()=>adapter.apply({bpm,planId:randomUUID()})};
}
for(const bpm of [20,60,84,100,120]){
 const f=fixture(bpm);assert.throws(()=>f.host.start());f.configure();assert.equal(f.host.snapshot().bpm,bpm);
 f.host.start();assert.equal(f.host.snapshot().phase,'watch');assert.equal(f.host.tap(1),false);
 f.advance(60000/bpm*.64);assert.notEqual(f.host.snapshot().visible,null);
 f.advance(60000/bpm*.02);assert.equal(f.host.snapshot().visible,null);
 f.advance(60000/bpm*.35);assert.equal(f.host.snapshot().phase,'respond');
 assert.equal(f.host.snapshot().responseMs,Math.round(600000/bpm));
 f.advance(Math.round(600000/bpm));assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().rounds,1);assert.equal(f.host.snapshot().level,1);assert.equal(f.jobs.size,0);
}
const f=fixture();f.configure();
for(let i=0;i<27;i++){const seq=f.watch();assert.equal(seq.length,Math.min(25,i+1));assert.equal(new Set(seq).size,seq.length);for(const cell of seq)assert.equal(f.host.tap(cell),true);assert.equal(f.host.snapshot().phase,'correct');assert.equal(f.host.snapshot().level,Math.min(25,i+2));assert.equal(f.jobs.size,0)}
assert.equal(f.host.snapshot().correct,27);assert.equal(f.host.snapshot().rounds,27);
let seq=f.watch();assert.equal(f.host.tap((seq[0]+1)%25),false);assert.equal(f.host.snapshot().phase,'retry');assert.equal(f.host.snapshot().level,24);
f.host.start();f.adapter.clear();assert.equal(f.host.snapshot().phase,'idle');assert.equal(f.host.snapshot().bpm,null);assert.equal(f.host.snapshot().rounds,0);assert.equal(f.jobs.size,0);f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');assert.throws(()=>f.host.start());
f.configure();f.watch();f.adapter.clear();f.advance(100000);assert.equal(f.host.snapshot().phase,'idle');assert.equal(f.host.tap(1),false);assert.equal(f.jobs.size,0);
console.log('PASS: Recall BPM flash and response timing, progression to 25 cells, unlimited rounds, incorrect response, timeout and cancellation');
