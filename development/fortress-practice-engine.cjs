'use strict';
// Isolated five-target Fortress practice. In-memory only. No network, audio,
// vibration, strobe, legacy scores or competition state.
function createFortressPractice({schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),random=Math.random,onState=()=>{},startLength=1,maxLength=25}={}){
 if(!Number.isInteger(startLength)||!Number.isInteger(maxLength)||startLength<1||maxLength<startLength||maxLength>25)throw Error('Invalid chain limits');
 let timing=null,phase='idle',chain=[],index=0,rounds=0,correct=0,best=0,visible=null,ordinal=null,deadline=null,generation=0;
 const timers=new Set();
 function snapshot(){return Object.freeze({phase,bpm:timing?.bpm??null,planId:timing?.planId??null,level:chain.length||startLength,rounds,correct,best,visible,ordinal,index,responseMs:timing?.responseMs??null,deadline})}
 function emit(){onState(snapshot())}
 function reset(){generation++;for(const id of timers)cancel(id);timers.clear();visible=null;ordinal=null;deadline=null}
 function later(fn,ms){const g=generation;const id=schedule(()=>{timers.delete(id);if(g===generation)fn()},ms);timers.add(id)}
 function cancelPractice(){reset();phase='idle';chain=[];index=0;rounds=0;correct=0;best=0;emit()}
 function clearTiming(){timing=null;cancelPractice()}
 function configureTiming(t){
  if(phase!=='idle'||!t||t.scoring!=='practice_only'||!Number.isInteger(t.bpm)||t.bpm<1||t.bpm>1000||t.beatMs!==60000/t.bpm||t.stepMs!==t.beatMs*.75||t.flashMs!==t.beatMs*.5||t.responseMs!==Math.round(t.beatMs*10)||typeof t.planId!=='string')throw Error('Invalid Fortress timing');
  timing=Object.freeze({...t});emit()
 }
 function draw(n){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random source');return Math.floor(r*n)}
 function nextBall(previous){if(previous===undefined)return draw(5);const n=draw(4);return n>=previous?n+1:n}
 function newChain(){const a=[];while(a.length<startLength)a.push(nextBall(a.at(-1)));return a}
 function finish(ok){reset();rounds++;if(ok){correct++;best=Math.max(best,chain.length)}phase=ok?'correct':'retry';emit()}
 function start(){
  if(!timing||!['idle','correct','retry'].includes(phase))throw Error('Fortress unavailable');
  const next=phase==='correct'&&chain.length<maxLength?[...chain,nextBall(chain.at(-1))]:newChain();
  reset();chain=next;index=0;phase='watch';
  const {stepMs,flashMs,responseMs}=timing;
  function show(i){visible=chain[i];ordinal=i+1;emit();later(()=>{visible=null;ordinal=null;emit()},flashMs)}
  show(0);for(let i=1;i<chain.length;i++)later(()=>show(i),i*stepMs);
  later(()=>{visible=null;ordinal=null;phase='respond';deadline=now()+responseMs;later(()=>finish(false),responseMs);emit()},chain.length*stepMs)
 }
 function tap(cell){
  if(phase!=='respond'||!Number.isInteger(cell)||cell<0||cell>4)return false;
  if(now()>=deadline){finish(false);return false}
  if(chain[index]!==cell){finish(false);return false}
  index++;if(index===chain.length)finish(true);else emit();return true
 }
 return Object.freeze({mode:'personalized_fortress',isIdle:()=>phase==='idle',configureTiming,cancelPractice,clearTiming,start,tap,snapshot});
}
if(typeof module!=='undefined')module.exports={createFortressPractice};
