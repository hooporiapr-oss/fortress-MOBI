'use strict';
// Isolated Recognition practice: compare two sequences differing at exactly one position.
// In-memory results only. No legacy scoring, audio, strobe or network.
function createRecognitionPractice({schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),random=Math.random,onState=()=>{}}={}){
 let timing=null,phase='idle',level=2,original=[],echo=[],changed=null,visible=null,ordinal=null,rounds=0,correct=0,deadline=null,generation=0;
 const timers=new Set();
 function snapshot(){return Object.freeze({phase,bpm:timing?.bpm??null,planId:timing?.planId??null,level,rounds,correct,visible,ordinal,choices:Object.freeze(phase==='finding'?echo.slice():[]),responseMs:timing?.responseMs??null,deadline})}
 function emit(){onState(snapshot())}
 function reset(){generation++;for(const id of timers)cancel(id);timers.clear();visible=null;ordinal=null;deadline=null}
 function later(fn,ms){const g=generation;const id=schedule(()=>{timers.delete(id);if(g===generation)fn()},ms);timers.add(id)}
 function cancelPractice(){reset();phase='idle';level=2;original=[];echo=[];changed=null;rounds=0;correct=0;emit()}
 function clearTiming(){timing=null;cancelPractice()}
 function configureTiming(t){
  if(phase!=='idle'||!t||t.scoring!=='practice_only'||!Number.isInteger(t.bpm)||t.bpm<1||t.bpm>1000||t.beatMs!==60000/t.bpm||t.flashMs!==t.beatMs*.55||t.transitionMs!==t.beatMs||t.responseMs!==Math.round(t.beatMs*10)||typeof t.planId!=='string')throw Error('Invalid Recognition timing');
  timing=Object.freeze({...t});emit();
 }
 function draw(n){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random source');return Math.floor(r*n)}
 function finish(ok){reset();rounds++;if(ok){correct++;level=Math.min(24,level+1)}else level=Math.max(2,level-1);phase=ok?'correct':'retry';emit()}
 function start(){
  if(!timing||!['idle','correct','retry'].includes(phase))throw Error('Recognition unavailable');
  const cells=Array.from({length:25},(_,i)=>i);
  for(let i=24;i>0;i--){const j=draw(i+1);[cells[i],cells[j]]=[cells[j],cells[i]]}
  const next=cells.slice(0,level),replacement=cells[level+draw(25-level)],pos=draw(level);
  reset();original=next;echo=original.slice();echo[pos]=replacement;changed=replacement;
  const {beatMs,flashMs,transitionMs,responseMs}=timing;
  function show(pattern,i){visible=pattern[i];ordinal=i+1;emit();later(()=>{visible=null;ordinal=null;emit()},flashMs)}
  function sequence(pattern,name,done){phase=name;show(pattern,0);for(let i=1;i<pattern.length;i++)later(()=>show(pattern,i),i*beatMs);later(done,pattern.length*beatMs)}
  sequence(original,'watch',()=>{phase='transition';visible=null;ordinal=null;emit();later(()=>sequence(echo,'echo',()=>{phase='finding';visible=null;ordinal=null;deadline=now()+responseMs;later(()=>finish(false),responseMs);emit()}),transitionMs)});
 }
 function tap(cell){
  if(phase!=='finding')return false;
  if(now()>=deadline){finish(false);return false}
  if(!Number.isInteger(cell)||!echo.includes(cell))return false;
  const ok=cell===changed;finish(ok);return ok;
 }
 return Object.freeze({mode:'personalized_recognition',isIdle:()=>phase==='idle',configureTiming,cancelPractice,clearTiming,start,tap,snapshot});
}
if(typeof module!=='undefined')module.exports={createRecognitionPractice};
