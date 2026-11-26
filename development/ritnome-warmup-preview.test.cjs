'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const html=load('ritnome-warmup-preview.html');
class Element{
 constructor(){this.listeners={};this.textContent='';this.value='';this.disabled=false;this.hidden=false;this.classes=new Set();this.classList={toggle:(k,v)=>v?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)}}
 addEventListener(k,fn){this.listeners[k]=fn}
 fire(k,e={}){return this.listeners[k]?.(e)}
 click(){if(!this.disabled)return this.fire('click')}
}
const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
const $=id=>{assert.ok(elements.has(id),id);return elements.get(id)};
$('mode').value='manual';$('bpm').value='90';$('duration').value='60';$('personal').disabled=true;
const dots=Array.from({length:4},()=>new Element());
const document=new Element();document.documentElement={lang:'es'};document.hidden=false;document.getElementById=$;document.querySelectorAll=q=>{assert.equal(q,'.beat');return dots};
let ms=0,serial=0;const jobs=new Map(),contexts=[],sources=[];
let resumeGate=null;
function audioNode(){return {gain:{value:0},threshold:{value:0},ratio:{value:0},connect(){},disconnect(){this.disconnected=true},start(at){this.at=at},stop(){this.stopped=true}}}
class AudioContext extends Element{
 constructor(){super();this.state='suspended';this.destination={};contexts.push(this)}
 get currentTime(){return ms/1000}
 createGain(){return audioNode()}createDynamicsCompressor(){return audioNode()}
 createBuffer(ch,n,sr){const data=new Float32Array(n);return {copyToChannel:a=>data.set(a)}}
 createBufferSource(){const n=audioNode();sources.push(n);return n}
 getOutputTimestamp(){return {contextTime:this.currentTime,performanceTime:ms+1000}}
 async resume(){if(resumeGate)await resumeGate;if(this.state!=='closed')this.state='running'}
 async close(){this.state='closed';this.fire('statechange')}
}
const window=new Element();window.AudioContext=AudioContext;
const deny=()=>{throw Error('No athlete data, network or persistence permitted')};
const ctx=vm.createContext({document,window,performance:{now:()=>ms},setInterval:(fn,period)=>{const id=++serial;jobs.set(id,{fn,period,at:ms+period});return id},clearInterval:id=>jobs.delete(id),fetch:deny,XMLHttpRequest:deny,localStorage:{getItem:deny,setItem:deny},sessionStorage:{getItem:deny,setItem:deny}});
for(const [,src] of html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g))vm.runInContext(load(src),ctx,{filename:src});
function advance(n){const end=ms+n;while(true){const job=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;ms=job[1].at;job[1].at+=job[1].period;job[1].fn()}ms=end}
function select(mode){$('mode').value=mode;$('mode').fire('change')}
(async()=>{
 assert.equal(document.documentElement.lang,'es');assert.equal($('start').textContent,'Comenzar');assert.equal($('tempo').textContent,'90 BPM');assert.equal($('personal').disabled,true);assert.equal($('stop').disabled,true);assert.equal($('tap').hidden,true);
 $('language').click();assert.equal(document.documentElement.lang,'en');assert.equal($('start').textContent,'Start');assert.match($('note').textContent,/no athlete data/);
 $('bpm').value='201';$('bpm').fire('input');assert.equal($('start').disabled,true);$('bpm').value='84';$('bpm').fire('input');assert.equal($('start').disabled,false);
 $('duration').value='30';await $('start').click();assert.equal(contexts.length,1);assert.equal($('status').textContent,'In rhythm');assert.equal($('mode').disabled,true);assert.equal($('bpm').disabled,true);assert.equal($('start').disabled,true);advance(800);assert.ok(sources.length>0);assert.equal(dots.filter(d=>d.classes.has('on')).length,1);
 advance(30000);assert.equal($('status').textContent,'Warm-up completed');assert.equal(jobs.size,0);assert.ok(sources.every(n=>n.stopped&&n.disconnected));assert.ok(dots.every(d=>!d.classes.has('on')));
 select('tap');assert.equal($('tap').hidden,false);assert.equal($('start').disabled,true);for(let i=0;i<4;i++){if(i)advance(714);$('tap').click()}assert.equal($('tempo').textContent,'84 BPM');assert.equal($('start').disabled,false);assert.equal($('bpm').disabled,true);
 $('duration').value='free';await $('start').click();advance(1000);assert.equal($('remaining').textContent,'—');$('stop').click();assert.equal(jobs.size,0);assert.equal($('status').textContent,'Ready');
 await $('start').click();advance(300);document.hidden=true;document.fire('visibilitychange');assert.equal(jobs.size,0);assert.equal($('stop').disabled,true);document.hidden=false;
 select('personal');assert.equal($('start').disabled,true);select('manual');await $('start').click();advance(300);contexts[0].state='suspended';contexts[0].fire('statechange');assert.equal(jobs.size,0);
 let release;resumeGate=new Promise(r=>release=r);const pending=$('start').click();assert.equal($('stop').disabled,false);$('stop').click();release();await pending;resumeGate=null;assert.equal(jobs.size,0);assert.equal($('stop').disabled,true);
 await $('start').click();window.fire('pagehide');assert.equal(jobs.size,0);assert.equal(contexts[0].state,'closed');await $('start').click();assert.equal(contexts.length,2);$('language').click();assert.equal($('stop').textContent,'Detener');$('stop').click();
 assert.match(html,/name="viewport"/);assert.match(html,/aria-live="polite"/);assert.equal([...html.matchAll(/<script src=/g)].length,4);
 console.log('PASS: Ritnome bilingual controls, manual/tap tempo, timed/free warm-up, cancellation, resume race and no persistence');
})().catch(e=>{console.error(e);process.exitCode=1});
