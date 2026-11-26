'use strict';
// Development-only bridge. Never persist credentials or use a fallback BPM.
// Read an exact saved prescription through the scoped Coach Memory client.
function createBpmBridge({client,getSelection,programs={},enabled=false}={}){
 if(!client||typeof client.request!=='function'||typeof client.invalidate!=='function'||typeof getSelection!=='function')throw Error('Invalid bridge configuration');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const fail=code=>Object.assign(new Error('Personal BPM unavailable'),{code});
 const registry=new Map(Object.entries(programs).map(([key,p])=>{
  if(!p||typeof p.apply!=='function'||typeof p.clear!=='function'||!Number.isInteger(p.min)||!Number.isInteger(p.max)||p.min<1||p.max>1000||p.min>p.max||typeof p.station!=='string')throw Error('Invalid program adapter');
  return [key,Object.freeze({...p})];
 }));
 let generation=0,active=null;
 function invalidate(){generation++;active=null;client.invalidate();let failed=false;for(const p of registry.values()){try{p.clear()}catch{failed=true}}if(failed)throw fail('clear_failed')}
 function selection(){const s=getSelection();if(!s||!uuid(s.membershipId)||!uuid(s.planId)||typeof s.sessionEpoch!=='string'||!s.sessionEpoch)throw fail('selection_required');return {...s}}
 function same(a,b){return a.membershipId===b.membershipId&&a.planId===b.planId&&a.sessionEpoch===b.sessionEpoch}
 async function launch(key){
  if(!enabled)throw fail('disabled');
  const p=registry.get(key);if(!p)throw fail('unsupported_program');
  invalidate();const g=generation,s=selection();
  const {records}=await client.request('read',{page_size:100});
  if(g!==generation||!same(s,selection()))throw fail('selection_changed');
  const matches=records.filter(r=>r.id===s.planId&&r.kind==='training_plan');
  if(matches.length!==1)throw fail('prescription_unavailable');
  const record=matches[0],payload=record.payload;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=k=>day.find(x=>x.type===k).value;
  const today=part('year')+'-'+part('month')+'-'+part('day');
  if(typeof record.effective_on!=='string'||record.effective_on>today||records.some(r=>r.supersedes_id===record.id))throw fail('prescription_unavailable');
  if(!payload||!Number.isInteger(payload.bpm)||payload.bpm<p.min||payload.bpm>p.max||!Array.isArray(payload.stations)||!payload.stations.includes(p.station))throw fail('incompatible_prescription');
  const config=Object.freeze({bpm:payload.bpm,planId:s.planId});
  try{p.apply(config)}catch{invalidate();throw fail('program_failed')}
  if(g!==generation||!same(s,selection())){invalidate();throw fail('selection_changed')}
  active={key,...config};return Object.freeze({...active});
 }
 return {launch,invalidate};
}
if(typeof module!=='undefined')module.exports={createBpmBridge};
