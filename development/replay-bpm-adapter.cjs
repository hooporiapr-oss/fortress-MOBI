'use strict';
// Isolated personal practice only. Both clocks use the same prescribed BPM.
function createReplayBpmAdapter({host,min=20,max=120}={}){
 if(!host||host.mode!=='personalized_replay'||typeof host.configureTiming!=='function'||typeof host.cancelPractice!=='function'||typeof host.clearTiming!=='function'||typeof host.isIdle!=='function')throw Error('Invalid isolated Replay host');
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>1000||min>max)throw Error('Invalid BPM limits');
 let active=null;
 function clear(){active=null;try{host.cancelPractice()}finally{host.clearTiming()}}
 function apply(config){
  if(!config||!Number.isInteger(config.bpm)||config.bpm<min||config.bpm>max||typeof config.planId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.planId))throw Error('Invalid Replay prescription');
  if(!host.isIdle())throw Error('Replay must be idle');
  active=null;
  const bpm=config.bpm,beatMs=60000/bpm;
  // Retain the original intended 520:180 flash-to-gap ratio.
  const timing=Object.freeze({bpm,beatMs,flashMs:beatMs*520/700,responseMs:Math.round(beatMs*10),planId:config.planId,scoring:'practice_only'});
  try{host.configureTiming(timing);active=timing}catch(e){clear();throw e}
 }
 return Object.freeze({station:'replay',min,max,apply,clear,getTiming:()=>active});
}
if(typeof module!=='undefined')module.exports={createReplayBpmAdapter};
