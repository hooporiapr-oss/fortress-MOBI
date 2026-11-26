'use strict';
// Development-only shared Cognitivo Gym integration contract.
// Existing public games are not loaded by this module.
function createCognitivoGymPracticeFactory(createBpmBridge){
 const stations=Object.freeze({zona:'zn',zonaRoja:'zr',encadena:'enc'});
 return function createCognitivoGymPractice({client,getSelection,subscribeSelection,hosts={},enabled=false}={}){
  if(typeof getSelection!=='function'||typeof subscribeSelection!=='function')throw Error('Selection lifecycle required');
  if(Object.keys(hosts).some(k=>!Object.hasOwn(stations,k)))throw Error('Unsupported Cognitivo Gym station');
  const adapters={},configured=new Map();
  for(const [key,host] of Object.entries(hosts)){
   if(!host||host.mode!=='personalized_practice'||host.station!==stations[key]||!['configureTiming','cancelPractice','clearTiming','isIdle','start'].every(k=>typeof host[k]==='function'))throw Error('Invalid isolated Cognitivo Gym host');
   adapters[key]=Object.freeze({station:stations[key],min:20,max:120,apply(config){
    if(!host.isIdle())throw Error('Host is not idle');
    const timing=Object.freeze({bpm:config.bpm,beatMs:Math.round(60000/config.bpm),planId:config.planId,scoring:'practice_only'});
    configured.delete(key);host.configureTiming(timing);configured.set(key,timing);
   },clear(){configured.delete(key);try{host.cancelPractice()}finally{host.clearTiming()}}});
  }
  const bridge=createBpmBridge({client,getSelection,programs:adapters,enabled});
  let closed=false,ready=null,epoch=0;
  const fail=code=>Object.assign(Error('Cognitivo Gym practice unavailable'),{code});
  const same=(a,b)=>!!a&&!!b&&a.membershipId===b.membershipId&&a.planId===b.planId&&a.sessionEpoch===b.sessionEpoch;
  function invalidate(){epoch++;ready=null;bridge.invalidate()}
  const unsubscribe=subscribeSelection(invalidate);
  if(typeof unsubscribe!=='function')throw Error('Selection unsubscribe required');
  async function launch(key){
   if(closed||!enabled)throw fail('disabled');
   invalidate();const g=epoch,s=getSelection(),expected=s&&{membershipId:s.membershipId,planId:s.planId,sessionEpoch:s.sessionEpoch};
   const config=await bridge.launch(key);
   if(closed||g!==epoch||!same(expected,getSelection())){if(g===epoch)invalidate();throw fail('selection_changed')}
   ready={key,selection:expected};return config;
  }
  function check(key){
   if(closed||!ready||ready.key!==key||!same(ready.selection,getSelection())||!configured.has(key)){invalidate();throw fail('selection_required')}
   return hosts[key];
  }
  function start(key){check(key).start()}
  function input(key,...args){const host=check(key);if(typeof host.input!=='function')throw fail('unsupported_input');return host.input(...args)}
  function dispose(){if(closed)return;closed=true;try{invalidate()}finally{unsubscribe()}}
  return Object.freeze({launch,start,input,stop:invalidate,dispose});
 }
}
if(typeof module!=='undefined'){
 const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
 module.exports={createCognitivoGymPractice:createCognitivoGymPracticeFactory(createBpmBridge)};
}else{window.createCognitivoGymPractice=createCognitivoGymPracticeFactory(createBpmBridge)}
