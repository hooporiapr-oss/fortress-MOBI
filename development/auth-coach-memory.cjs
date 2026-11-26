'use strict';
// Development only. No BPM prescriptions, legacy gate credentials or persistent browser storage.
const {createCoachMemoryClient}=require('./coach-memory-client.cjs');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=code=>Object.assign(Error('Coach Memory unavailable'),{code});
function createAuthCoachMemory({auth,endpoint,enabled=false,fetchImpl,onChange=()=>{}}={}){
 if(!auth||typeof auth.getUser!=='function'||typeof auth.onAuthStateChange!=='function')throw Error('Auth required');
 let closed=false,epoch=0,session=null,membership=null,revision=0,timer;
 function emit(){try{onChange(state())}catch{}}
 function state(){return Object.freeze({authenticated:!!(session&&session.expiry>Date.now()),membershipId:membership,enabled:enabled&&!closed})}
 function clear(){epoch++;revision++;session=null;membership=null;clearTimeout(timer);client.invalidate();emit()}
 const client=createCoachMemoryClient({endpoint,enabled,fetchImpl,getContext:async()=>{
  const s=session,m=membership,g=revision;
  if(closed||!s||!m||s.expiry<=Date.now())return null;
  try{const {data,error}=await auth.getUser(s.token);
   if(error||data?.user?.id!==s.id||data?.user?.is_anonymous!==false){if(session===s)clear();return null}
   if(closed||session!==s||membership!==m||g!==revision||s.expiry<=Date.now())return null;
   return {membershipId:m,accessToken:s.token};
  }catch{if(session===s)clear();return null}
 }});
 async function verify(s,g){
  try{const token=s?.access_token,expiry=Number(s?.expires_at)*1000;
   if(!enabled||closed||g!==epoch||typeof token!=='string'||!/^[-\w]+[.][-\w]+[.][-\w]+$/.test(token)||!Number.isFinite(expiry)||expiry<=Date.now())return;
   const {data,error}=await auth.getUser(token);
   if(closed||g!==epoch||error||!uuid(data?.user?.id)||data.user.id!==s.user?.id||data.user.is_anonymous!==false||expiry<=Date.now())return;
   session={id:data.user.id,token,expiry};timer=setTimeout(()=>{if(g===epoch)clear()},Math.min(expiry-Date.now(),2147483647));timer.unref?.();emit();
  }catch{if(g===epoch)clear()}
 }
 const {data:{subscription}}=auth.onAuthStateChange((event,s)=>{if(closed)return;clear();const g=epoch;if(s&&event!=='SIGNED_OUT')setTimeout(()=>void verify(s,g),0)});
 function select(id){if(!enabled||closed||!session||session.expiry<=Date.now())throw fail('authentication_required');if(id!==null&&!uuid(id))throw fail('invalid_request');revision++;client.invalidate();membership=id;emit()}
 function savePlan({requestId,effectiveOn,stage,days,stations}={}){
  if(!uuid(requestId)||typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)||!['5-6','7-8','9-10','11-12','13-14','15-17','other'].includes(stage)||!Number.isInteger(days)||days<2||days>5||!Array.isArray(stations)||!stations.length||new Set(stations).size!==stations.length||stations.some(s=>!['recall','recognition','replay','fortress','zn','zr','enc','ritnome'].includes(s)))return Promise.reject(fail('invalid_request'));
  return client.request('save_plan',{request_id:requestId,effective_on:effectiveOn,plan:{stage,days,stations:[...stations],bpm:null}});
 }
 function history({pageSize=25,beforeTime,beforeId}={}){
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100||(beforeTime==null)!==(beforeId==null)||(beforeId!=null&&(!uuid(beforeId)||typeof beforeTime!=='string'||!Number.isFinite(Date.parse(beforeTime)))))return Promise.reject(fail('invalid_request'));
  return client.request('read',{page_size:pageSize,...(beforeId!=null?{before_time:beforeTime,before_id:beforeId}:{})});
 }
 function dispose(){if(closed)return;closed=true;clear();subscription.unsubscribe()}
 return Object.freeze({state,select,savePlan,history,dispose});
}
module.exports={createAuthCoachMemory};
