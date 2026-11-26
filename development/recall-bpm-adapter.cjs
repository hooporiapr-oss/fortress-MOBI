'use strict';
// Development-only Recall adapter. The host must be an isolated practice engine,
// not the legacy competition or warm-up page. No automatic game start or score upload.
function createRecallBpmAdapter({host,min=20,max=120}={}){
 if(!host||host.mode!=='personalized_practice'||typeof host.configureTiming!=='function'||typeof host.cancelPractice!=='function'||typeof host.clearTiming!=='function'||typeof host.isIdle!=='function')throw Error('Invalid isolated Recall host');
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>1000||min>max)throw Error('Invalid BPM limits');
 let active=null;
 function clear(){
  active=null;
  try{host.cancelPractice()}finally{host.clearTiming()}
 }
 function apply(config){
  if(!config||!Number.isInteger(config.bpm)||config.bpm<min||config.bpm>max||typeof config.planId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.planId))throw Error('Invalid Recall prescription');
  if(!host.isIdle())throw Error('Recall must be idle');
  active=null;
  const bpm=config.bpm;
  const timing=Object.freeze({bpm,beatMs:60000/bpm,responseMs:Math.round(600000/bpm),planId:config.planId,scoring:'practice_only'});
  try{host.configureTiming(timing);active=timing}catch(e){clear();throw e}
 }
 return Object.freeze({station:'recall',min,max,apply,clear,getTiming:()=>active});
}
if(typeof module!=='undefined')module.exports={createRecallBpmAdapter};
