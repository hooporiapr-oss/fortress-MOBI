'use strict';
const assert=require('node:assert/strict');
const {createRitnomeClock}=require('./ritnome-clock.cjs');
const {createRitnomeAudio}=require('./ritnome-audio.cjs');
function fixture(){
 let time=0,id=0;const jobs=new Map(),steps=[],refs=[],beats=[],reasons=[];
 const audio={prepare(){},scheduleStep(step,at,sub){steps.push({step,at,sub})},cancel(){steps.push({cancel:true})}};
 const clock=createRitnomeClock({audio,now:()=>time,performanceNow:()=>10000+time*1000,outputTimestamp:()=>({contextTime:time,performanceTime:10000+time*1000}),interval(fn){jobs.set(++id,fn);return id},clear:i=>jobs.delete(i),onScheduledBeat:e=>refs.push(e),onBeat:e=>beats.push(e),onState:(s,r)=>reasons.push(r)});
 function advance(seconds){const end=time+seconds;while(time<end-1e-9){time=Math.min(end,time+.025);for(const fn of [...jobs.values()])fn()}}
 return {clock,jobs,steps,refs,beats,reasons,advance,jump(seconds){time+=seconds;for(const fn of [...jobs.values()])fn()}};
}
for(const bpm of [40,60,84,100,120,200]){
 const f=fixture(),c=f.clock;c.configure({bpm,source:'manual'});c.start(30);f.advance(5);
 assert.equal(c.snapshot().state,'running');assert.ok(f.refs.length>=3);
 for(let i=0;i<f.refs.length;i++){const r=f.refs[i];assert.equal(r.beatIndex,i);assert.ok(Math.abs(r.audioTime-(.15+i*60/bpm))<1e-8);assert.equal(r.calibrated,false);assert.equal(r.method,'output_timestamp');assert.ok(Object.isFrozen(r))}
 const r=f.beats.at(-1);assert.ok(r);assert.equal(c.timingError(r.performanceMs+24,r).errorMs,24);assert.equal(c.timingError(r.performanceMs-18,r).errorMs,-18);
 assert.equal(c.timingError(r.performanceMs+24,r,{offsetMs:10,calibrationId:'test'}).errorMs,14);assert.throws(()=>c.timingError(r.performanceMs,r,{offsetMs:10}));assert.throws(()=>c.configure({bpm:100,source:'manual'}));
 f.advance(26);assert.equal(c.snapshot().state,'idle');assert.equal(f.jobs.size,0);assert.equal(f.reasons.at(-1),'completed');assert.ok(f.steps.filter(x=>!x.cancel).every(x=>x.at<30.15));assert.throws(()=>c.timingError(r.performanceMs,r));
}
const f=fixture();assert.throws(()=>f.clock.start());for(const bpm of [39,201,84.5,'84',null])assert.throws(()=>f.clock.configure({bpm,source:'manual'}));
f.clock.configure({bpm:84,source:'tap'});assert.throws(()=>f.clock.start(10));f.clock.start(null);f.advance(1);const old=f.refs[0];f.clock.stop();assert.equal(f.jobs.size,0);const count=f.refs.length;f.advance(2);assert.equal(f.refs.length,count);
f.clock.configure({bpm:90,source:'personal'});f.clock.start(null);assert.throws(()=>f.clock.timingError(old.performanceMs,old));f.jump(2);assert.equal(f.clock.snapshot().state,'idle');assert.equal(f.reasons.at(-1),'clock_interrupted');f.clock.clearTempo();assert.equal(f.clock.snapshot().bpm,null);
let t=0;const fallback=createRitnomeClock({audio:{prepare(){},scheduleStep(){},cancel(){}},now:()=>t,performanceNow:()=>1000+t*1000,interval(){return 1},clear(){},onScheduledBeat:r=>{assert.equal(r.method,'estimated');assert.equal(r.calibrated,false)}});fallback.configure({bpm:200,source:'manual'});fallback.start();fallback.stop();
// Fake Web Audio verifies synthesized samples and cancellation of scheduled sources.
const nodes=[],buffers=[];function node(){return {gain:{value:0},threshold:{value:0},ratio:{value:0},connect(){},disconnect(){this.disconnected=true},start(at){this.at=at},stop(){this.stopped=true}}}
const context={destination:{},createGain:node,createDynamicsCompressor:node,createBuffer(ch,n,sr){const data=new Float32Array(n);const b={ch,n,sr,data,copyToChannel(a){data.set(a)}};buffers.push(b);return b},createBufferSource(){const n=node();nodes.push(n);return n}};
const audio=createRitnomeAudio(context);audio.prepare();assert.equal(buffers.length,24);assert.ok(buffers.every(b=>b.sr===44100&&b.data.every(Number.isFinite)&&b.data.some(x=>x!==0)));
audio.scheduleStep(0,1,.125);assert.equal(nodes.length,2);assert.ok(nodes.every(n=>n.at===1));audio.scheduleStep(3,1.375,.125);assert.equal(nodes.length,3);audio.scheduleStep(63,8,.125);assert.ok(nodes.some(n=>n.at===8.0625));audio.cancel();assert.ok(nodes.every(n=>n.stopped&&n.disconnected));audio.dispose();assert.throws(()=>audio.prepare());
console.log('PASS: Ritnome conga synthesis, beat timestamps, tempo range, timing error, session isolation, duration and cancellation');
