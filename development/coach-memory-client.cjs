// Development-only frontend transport. Not loaded by the live Coach View.
'use strict';
function createCoachMemoryClient({endpoint,enabled=false,getContext,fetchImpl=globalThis.fetch}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/v1/coach-memory'||typeof getContext!=='function')throw Error('Invalid configuration');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const fail=code=>Object.assign(new Error('Coach Memory unavailable'),{code});
 let generation=0;
 function invalidate(){generation++}
 async function request(action,fields={}){
  if(!enabled)throw fail('disabled');
  const g=generation,ctx=await getContext();
  if(g!==generation)throw fail('selection_changed');
  if(!ctx||!uuid(ctx.membershipId)||typeof ctx.accessToken!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(ctx.accessToken)||ctx.accessToken.length>8192)throw fail('authentication_required');
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw fail('invalid_request');
  const keys={submit_bpm:['request_id','bpm','measured_at'],confirm_bpm:['request_id','measurement_id'],save_bpm_plan:['request_id','confirmation_id','effective_on','plan'],save_plan:['request_id','effective_on','plan'],read:['page_size','before_time','before_id'],get_bpm_plan:['plan_id','station']}[action];
  if(!Array.isArray(keys)||Object.keys(fields).some(k=>!keys.includes(k)))throw fail('invalid_request');
  if(action!=='read'&&action!=='get_bpm_plan'&&!uuid(fields.request_id))throw fail('invalid_request');
  if(action==='get_bpm_plan'&&(!uuid(fields.plan_id)||!['recall','recognition','replay','fortress','zn','zr','enc'].includes(fields.station)))throw fail('invalid_request');
  if(action==='submit_bpm'&&(!Number.isInteger(fields.bpm)||fields.bpm<1||fields.bpm>1000||typeof fields.measured_at!=='string'||!Number.isFinite(Date.parse(fields.measured_at))))throw fail('invalid_request');
  if(action==='confirm_bpm'&&!uuid(fields.measurement_id))throw fail('invalid_request');
  if(action==='save_bpm_plan'&&(!uuid(fields.confirmation_id)||!fields.plan||Object.hasOwn(fields.plan,'bpm')))throw fail('invalid_request');
  if(action==='save_plan'&&fields.plan?.bpm!==null)throw fail('invalid_request');
  let res;
  try{res=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ctx.accessToken},body:JSON.stringify({...fields,action,membership_id:ctx.membershipId}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)})}catch{throw fail('unavailable')}
  if(g!==generation)throw fail('selection_changed');
  if(!res.ok)throw fail(({400:'invalid_request',401:'authentication_required',403:'forbidden'})[res.status]||'unavailable');
  let data;try{data=await res.json()}catch{throw fail('unavailable')}
  if(g!==generation)throw fail('selection_changed');
  if(action==='get_bpm_plan'){
   const p=data?.prescription;
   if(!p||p.membership_id!==ctx.membershipId||p.plan_id!==fields.plan_id||p.station!==fields.station||!uuid(p.confirmation_id)||!Number.isInteger(p.bpm)||p.bpm<1||p.bpm>1000||typeof p.effective_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_on)||!['5-6','7-8','9-10','11-12','13-14','15-17','other'].includes(p.stage))throw fail('unavailable');
   return {prescription:Object.freeze({membership_id:p.membership_id,plan_id:p.plan_id,confirmation_id:p.confirmation_id,station:p.station,bpm:p.bpm,effective_on:p.effective_on,stage:p.stage})};
  }
  if(action==='read'?!Array.isArray(data?.records):!uuid(data?.id))throw fail('unavailable');
  return action==='read'?{records:data.records}:{id:data.id};
 }
 return {request,invalidate};
}
if(typeof module!=='undefined')module.exports={createCoachMemoryClient};
