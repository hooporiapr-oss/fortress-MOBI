'use strict';
// Audio time is authoritative. Performance timestamps are for future input
// analysis, not assumed to be calibrated audible beat times.
function createRitnomeClock({audio,now,performanceNow=()=>performance.now(),outputTimestamp,interval=setInterval,clear=clearInterval,onBeat=()=>{},onState=()=>{},onScheduledBeat=()=>{}}={}){
 if(!audio||typeof now!=='function'||!['prepare','scheduleStep','cancel'].every(k=>typeof audio[k]==='function'))throw Error('Invalid clock');
 let state='idle',bpm=null,source=null,step=0,origin=0,end=Infinity,timer=null,epoch=0,queue=[],lastScheduled=-1,session=null;
 const valid=v=>Number.isInteger(v)&&v>=40&&v<=200;
 function snapshot(){return Object.freeze({state,bpm,source,session,remainingSeconds:state==='running'&&Number.isFinite(end)?Math.max(0,end-now()):null})}
 function stop(reason='stopped'){epoch++;if(timer!==null){clear(timer);timer=null}queue=[];audio.cancel();state='idle';session=null;onState(snapshot(),reason)}
 function configure({bpm:value,source:kind}={}){
  if(state!=='idle'||!valid(value)||!['manual','tap','personal'].includes(kind))throw Error('Invalid tempo');
  bpm=value;source=kind;onState(snapshot(),'configured')
 }
 function clearTempo(){stop();bpm=null;source=null;onState(snapshot(),'cleared')}
 function mapTime(audioTime){
  let stamp;try{stamp=outputTimestamp?.()}catch{}
  if(stamp&&Number.isFinite(stamp.contextTime)&&Number.isFinite(stamp.performanceTime)&&stamp.performanceTime>0)return Object.freeze({performanceMs:stamp.performanceTime+(audioTime-stamp.contextTime)*1000,method:'output_timestamp',calibrated:false});
  return Object.freeze({performanceMs:performanceNow()+(audioTime-now())*1000,method:'estimated',calibrated:false});
 }
 function tick(){
  if(state!=='running')return;
  const g=epoch,t=now(),sixteenth=60/bpm/4;
  if(t>=end){stop('completed');return}
  // Do not replay missed beats after a suspended or overloaded tab.
  if(origin+step*sixteenth<t-.03){stop('clock_interrupted');return}
  try{
   while(origin+step*sixteenth<Math.min(t+.12,end)){
    const at=origin+step*sixteenth;
    audio.scheduleStep(step,at,sixteenth);
    if(step%4===0){
     const event=Object.freeze({session,beatIndex:step/4,audioTime:at,bpm,...mapTime(at)});
     queue.push(event);lastScheduled=event.beatIndex;onScheduledBeat(event);if(g!==epoch)return
    }
    step++;
   }
   while(queue.length&&queue[0].audioTime<=t){onBeat(queue.shift());if(g!==epoch)return}
  }catch{stop('audio_error');return}
  onState(snapshot(),'tick');
 }
 function start(durationSeconds=60){
  if(state!=='idle'||!valid(bpm)||![30,60,120,null].includes(durationSeconds))throw Error('Invalid warm-up start');
  audio.prepare();const g=++epoch;session=g;step=0;lastScheduled=-1;queue=[];origin=now()+.15;end=durationSeconds===null?Infinity:origin+durationSeconds;state='running';
  onState(snapshot(),'started');if(g!==epoch)return;tick();if(g===epoch&&state==='running')timer=interval(tick,25)
 }
 // Future interactive mode: signed error against a scheduled reference.
 // Never interpret this as a clinically validated or latency-corrected score.
 function timingError(inputPerformanceMs,reference,{offsetMs=0,calibrationId=null}={}){
  if(!Number.isFinite(inputPerformanceMs)||!reference||reference.session!==session||state!=='running'||!Number.isInteger(reference.beatIndex)||reference.beatIndex<0||reference.beatIndex>lastScheduled||!Number.isFinite(reference.performanceMs)||!Number.isFinite(offsetMs)||Math.abs(offsetMs)>1000||(!calibrationId&&offsetMs!==0))throw Error('Invalid timing reference');
  return Object.freeze({session,beatIndex:reference.beatIndex,errorMs:inputPerformanceMs-reference.performanceMs-offsetMs,calibrationId,referenceMethod:reference.method,validated:false})
 }
 return Object.freeze({configure,clearTempo,start,stop,snapshot,timingError});
}
if(typeof module!=='undefined')module.exports={createRitnomeClock};
