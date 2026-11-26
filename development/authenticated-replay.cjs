'use strict';
// Development only. The host supplies authenticated selection and change events.
// No synthetic tempo, URL credentials, automatic fallback, or persisted identity.
function createAuthenticatedReplayFactory(createReplayPractice,createReplayBpmAdapter,createBpmBridge){
return function createAuthenticatedReplay({client,getSelection,subscribeSelection,enabled=false,onState=()=>{},engineOptions={}}={}){
 if(typeof getSelection!=='function'||typeof subscribeSelection!=='function')throw Error('Selection lifecycle required');
 let closed=false,ready=null,epoch=0;
 const host=createReplayPractice({...engineOptions,onState});
 const adapter=createReplayBpmAdapter({host});
 const bridge=createBpmBridge({client,getSelection,programs:{replay:adapter},enabled});
 const fail=code=>Object.assign(Error('Replay unavailable'),{code});
 function invalidate(){epoch++;ready=null;bridge.invalidate()}
 const unsubscribe=subscribeSelection(invalidate);
 if(typeof unsubscribe!=='function')throw Error('Selection unsubscribe required');
 function same(a,b){return !!a&&!!b&&a.membershipId===b.membershipId&&a.planId===b.planId&&a.sessionEpoch===b.sessionEpoch}
 function check(){if(closed||!ready||!same(ready,getSelection())){invalidate();throw fail('selection_required')}}
 async function launch(){
  if(closed||!enabled)throw fail('disabled');
  invalidate();const g=epoch,s=getSelection();
  const expected=s&&{membershipId:s.membershipId,planId:s.planId,sessionEpoch:s.sessionEpoch};
  const config=await bridge.launch('replay');
  if(closed||g!==epoch||!same(expected,getSelection())){if(g===epoch)invalidate();throw fail('selection_changed')}
  ready=expected;return config;
 }
 function start(){check();host.start()}
 function tap(cell){check();return host.tap(cell)}
 function stop(){invalidate()}
 function dispose(){if(closed)return;closed=true;try{invalidate()}finally{unsubscribe()}}
 return Object.freeze({launch,start,tap,stop,dispose,snapshot:host.snapshot});
}
}
if(typeof module!=='undefined'){
 const {createReplayPractice}=require('./replay-practice-engine.cjs');
 const {createReplayBpmAdapter}=require('./replay-bpm-adapter.cjs');
 const {createBpmBridge}=require('./universal-bpm-bridge.cjs');
 module.exports={createAuthenticatedReplay:createAuthenticatedReplayFactory(createReplayPractice,createReplayBpmAdapter,createBpmBridge)};
}
else { window.createAuthenticatedReplay=createAuthenticatedReplayFactory(createReplayPractice,createReplayBpmAdapter,createBpmBridge); }
