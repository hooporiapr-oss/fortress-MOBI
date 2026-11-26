'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const html=load('recognition-practice-preview.html');
class Node {
 constructor(){this.children=[];this.listeners={};this.attrs={};this.disabled=false;this.textContent='';this.classes=new Set();this.classList={toggle:(c,v)=>v?this.classes.add(c):this.classes.delete(c)}}
 appendChild(n){this.children.push(n)}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,fn){this.listeners[k]=fn}
 fire(k,e={}){this.listeners[k]?.(e)}
 click(){if(!this.disabled)this.fire('click')}
}
const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Node()]));
const $=id=>{assert.ok(elements.has(id),id);return elements.get(id)};
const document=new Node();document.documentElement={lang:'es'};document.hidden=false;document.getElementById=$;document.createElement=()=>new Node();
const window=new Node();
let t=0,seq=0;const timers=new Map();
const deny=()=>{throw Error('Preview must not access network or persistence')};
const ctx=vm.createContext({document,window,performance:{now:()=>t},setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:t+ms});return id},clearTimeout:id=>timers.delete(id),fetch:deny,XMLHttpRequest:deny,localStorage:{getItem:deny,setItem:deny},sessionStorage:{getItem:deny,setItem:deny}});
for(const [,src] of html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g))vm.runInContext(load(src),ctx,{filename:src});
function advance(ms){const end=t+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;t=next[1].at;timers.delete(next[0]);next[1].fn()}t=end}
const cells=$('court').children;
assert.equal(cells.length,25);assert.equal(document.documentElement.lang,'es');assert.equal($('start').textContent,'Comenzar');assert.equal($('tempo').textContent,'84 BPM');assert.match($('note').textContent,/simulado/);assert.ok(cells.every(c=>c.disabled));assert.equal($('stop').disabled,true);
$('language').click();assert.equal(document.documentElement.lang,'en');assert.equal($('start').textContent,'Start');assert.equal(cells[0].attrs['aria-label'],'Cell 1');assert.match($('note').textContent,/Simulated/);
$('start').click();assert.equal($('status').textContent,'Memorize the original pattern');assert.equal($('start').disabled,true);
const beat=60000/84,original=[],echo=[];
function lit(cls){const i=cells.findIndex(c=>c.classes.has(cls));assert.ok(i>=0);assert.ok(cells.every(c=>c.disabled));return i}
original.push(lit('lit'));assert.equal(cells[original[0]].textContent,'1');
advance(beat+0.00001);original.push(lit('lit'));assert.equal(cells[original[1]].textContent,'2');
advance(beat);assert.equal($('status').textContent,'Get ready for the echo');assert.ok(cells.every(c=>c.disabled));
advance(beat);assert.equal($('status').textContent,'Watch the modified pattern');echo.push(lit('echo'));
advance(beat);echo.push(lit('echo'));advance(beat);
assert.equal($('status').textContent,'Tap the changed position');assert.equal(cells.filter(c=>!c.disabled).length,2);assert.equal(cells.filter(c=>c.classes.has('choice')).length,2);
const changed=echo.find(i=>!original.includes(i));assert.notEqual(changed,undefined);
cells[changed].click();assert.equal($('correct').textContent,1);assert.equal($('level').textContent,3);assert.equal($('rounds').textContent,1);assert.equal($('start').textContent,'Next round');
$('language').click();assert.equal($('start').textContent,'Otra ronda');$('start').click();$('stop').click();assert.equal(timers.size,0);assert.equal($('rounds').textContent,0);assert.equal($('status').textContent,'Listo para practicar');
$('start').click();document.hidden=true;document.fire('visibilitychange');assert.equal(timers.size,0);assert.ok(cells.every(c=>c.disabled));document.hidden=false;
$('start').click();window.fire('pagehide');assert.equal(timers.size,0);assert.equal($('tempo').textContent,'— BPM');assert.equal($('start').disabled,true);window.fire('pageshow',{persisted:true});assert.equal($('tempo').textContent,'84 BPM');assert.equal($('start').disabled,false);
assert.match(html,/name="viewport"/);assert.match(html,/aria-live="polite"/);assert.equal([...html.matchAll(/<script src=/g)].length,3);
console.log('PASS: synthetic Recognition DOM controls, ES/EN, gameplay, cancellation, page lifecycle and no network or persistence');
