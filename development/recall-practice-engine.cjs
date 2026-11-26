'use strict';
// Isolated practice engine. In-memory results only; no competition or legacy writes.
function createRecallPractice({schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),random=Math.random,onState=()=>{}}={}){
 let timing=null,phase='idle',level=1,sequence=[],index=0,rounds=0,correct=0,generation=0,timers=new Set(),deadline=null,visible=null;
 function snapshot(){return Object.freeze({phase,bpm:timing?.bpm??null,level,rounds,correct,visible,index,responseMs:timing?.responseMs??null,deadline,planId:timing?.planId??null})}
 function emit(){onState(snapshot())}
 function resetTimers(){generation++;for(const id of timers)cancel(id);timers.clear();deadline=null;visible=null}
 function later(fn,ms){const g=generation;const id=schedule(()=>{timers.delete(id);if(g===generation)fn()},ms);timers.add(id)}
 function cancelPractice(){resetTimers();phase='idle';level=1;sequence=[];index=0;rounds=0;correct=0;emit()}
 function clearTiming(){cancelPractice();timing=null;emit()}
 function configureTiming(t){
  if(phase!=='idle'||!t||t.scoring!=='practice_only'||!Number.isInteger(t.bpm)||t.bpm<1||t.bpm>1000||t.beatMs!==60000/t.bpm||t.responseMs!==Math.round(600000/t.bpm)||typeof t.planId!=='string')throw Error('Invalid practice timing');
  timing=Object.freeze({...t});emit();
 }
 function finish(ok){resetTimers();rounds++;if(ok){correct++;level=Math.min(25,level+1)}else level=Math.max(1,level-1);phase=ok?'correct':'retry';emit()}
 function start(){
  if(!timing||!['idle','correct','retry'].includes(phase))throw Error('Practice unavailable');
  resetTimers();index=0;const cells=Array.from({length:25},(_,i)=>i);
  for(let i=cells.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random source');const j=Math.floor(r*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]]}
  sequence=cells.slice(0,level);phase='watch';const beat=timing.beatMs;
  function flash(i){visible=sequence[i];emit();later(()=>{visible=null;emit()},beat*.65)}
  flash(0);for(let i=1;i<sequence.length;i++)later(()=>flash(i),i*beat);
  later(()=>{visible=null;phase='respond';deadline=now()+timing.responseMs;later(()=>finish(false),timing.responseMs);emit()},sequence.length*beat);
 }
 function tap(cell){
  if(phase!=='respond'||!Number.isInteger(cell)||cell<0||cell>24)return false;
  if(now()>=deadline){finish(false);return false}
  if(sequence[index]!==cell){finish(false);return false}
  index++;if(index===sequence.length)finish(true);else emit();return true;
 }
 return Object.freeze({mode:'personalized_practice',isIdle:()=>phase==='idle',configureTiming,cancelPractice,clearTiming,start,tap,snapshot});
}
if(typeof module!=='undefined')module.exports={createRecallPractice};
