'use strict';
// Development-only Recognition adapter. Keep the actual legacy ten-beat find window;
// its playbook advertises four beats, but the running competition code uses ten.
// A separate practice host must implement cancellation and never upload scores.
function createRecognitionBpmAdapter({host,min=20,max=120}={}){
 if(!host||host.mode!=='personalized_recognition'||typeof host.configureTiming!=='function'||typeof host.cancelPractice!=='function'||typeof host.clearTiming!=='function'||typeof host.isIdle!=='function')throw Error('Invalid isolated Recognition host');
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>1000||min>max)throw Error('Invalid BPM limits');
 let active=null;
 function clear(){active=null;try{host.cancelPractice()}finally{host.clearTiming()}}
 function apply(config){
  if(!config||!Number.isInteger(config.bpm)||config.bpm<min||config.bpm>max||typeof config.planId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.planId))throw Error('Invalid Recognition prescription');
  if(!host.isIdle())throw Error('Recognition must be idle');
  const bpm=config.bpm,beatMs=60000/bpm;
  active=null;
  const timing=Object.freeze({bpm,beatMs,flashMs:beatMs*.55,transitionMs:beatMs,responseMs:Math.round(beatMs*10),planId:config.planId,scoring:'practice_only'});
  try{host.configureTiming(timing);active=timing}catch(e){clear();throw e}
 }
 return Object.freeze({station:'recognition',min,max,apply,clear,getTiming:()=>active});
}
if(typeof module!=='undefined')module.exports={createRecognitionBpmAdapter};
