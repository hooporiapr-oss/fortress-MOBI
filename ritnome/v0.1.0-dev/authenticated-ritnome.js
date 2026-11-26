'use strict';
// Development-only authenticated warm-up. The host supplies a scoped client,
// current selection and synchronous lifecycle notifications. No persistence.
function createAuthenticatedRitnome({clock,client,getSelection,subscribeSelection,enabled=false}={}){
 if(!clock||!['configure','clearTempo','start','stop','snapshot'].every(k=>typeof clock[k]==='function')||!client||typeof client.request!=='function'||typeof client.invalidate!=='function'||typeof getSelection!=='function'||typeof subscribeSelection!=='function')throw Error('Invalid Ritnome host');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const fail=code=>Object.assign(Error('Personal Ritnome unavailable'),{code});
 let closed=false,epoch=0,ready=null;
 function invalidate(){epoch++;ready=null;try{clock.clearTempo()}finally{client.invalidate()}}
 function selection(){const s=getSelection();if(!s||!uuid(s.membershipId)||!uuid(s.planId)||typeof s.sessionEpoch!=='string'||!s.sessionEpoch)throw fail('selection_required');return {membershipId:s.membershipId,planId:s.planId,sessionEpoch:s.sessionEpoch}}
 function same(a,b){return !!a&&!!b&&a.membershipId===b.membershipId&&a.planId===b.planId&&a.sessionEpoch===b.sessionEpoch}
 function matches(s){try{return same(s,selection())}catch{return false}}
 const unsubscribe=subscribeSelection(invalidate);
 if(typeof unsubscribe!=='function')throw Error('Selection unsubscribe required');
 async function launch(){
  if(closed||!enabled)throw fail('disabled');
  invalidate();const g=epoch,s=selection();
  try{
   const {prescription:p}=await client.request('get_bpm_plan',{plan_id:s.planId,station:'ritnome'});
   if(closed||g!==epoch||!matches(s))throw fail('selection_changed');
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
   const part=k=>parts.find(x=>x.type===k).value,today=part('year')+'-'+part('month')+'-'+part('day');
   if(!p||p.membership_id!==s.membershipId||p.plan_id!==s.planId||p.station!=='ritnome'||!uuid(p.confirmation_id)||!['9-10','11-12','13-14','15-17','other'].includes(p.stage)||!Number.isInteger(p.bpm)||p.bpm<40||p.bpm>200||typeof p.effective_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_on)||p.effective_on>today)throw fail('incompatible_prescription');
   clock.configure({bpm:p.bpm,source:'personal'});
   if(closed||g!==epoch||!matches(s))throw fail('selection_changed');
   ready={...s,bpm:p.bpm};return Object.freeze({bpm:p.bpm,source:'personal'});
  }catch(err){if(g===epoch)invalidate();throw err}
 }
 function start(duration=60){
  if(closed||!enabled||!ready||!matches(ready)||clock.snapshot().source!=='personal'||clock.snapshot().bpm!==ready.bpm){invalidate();throw fail('selection_required')}
  try{clock.start(duration)}catch(err){invalidate();throw err}
  if(!ready||!matches(ready)){invalidate();throw fail('selection_changed')}
 }
 function stop(){invalidate()}
 function dispose(){if(closed)return;closed=true;try{invalidate()}finally{unsubscribe()}}
 return Object.freeze({launch,start,stop,dispose,snapshot:clock.snapshot});
}
if(typeof module!=='undefined')module.exports={createAuthenticatedRitnome};
