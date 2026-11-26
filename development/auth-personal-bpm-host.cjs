'use strict';
// Development only. Supply a genuine Supabase Auth client; legacy gate codes are not credentials.
const {createPersonalBpmHost}=require('./personal-bpm-host.cjs');
const {createCoachMemoryClient}=require('./coach-memory-client.cjs');
function createAuthPersonalBpmHost({auth,endpoint,enabled=false,fetchImpl}={}){
 if(!auth||typeof auth.getUser!=='function'||typeof auth.onAuthStateChange!=='function')throw Error('Auth client required');
 let closed=false,generation=0,current=null,token=null,expires=0,timer=null;
 const listeners=new Set();
 function clear(){generation++;current=null;token=null;expires=0;clearTimeout(timer);for(const fn of [...listeners]){try{fn()}catch{}}}
 function getSession(){return !closed&&current&&Date.now()<expires?current:null}
 const client=createCoachMemoryClient({endpoint,enabled,fetchImpl,getContext:async()=>{
  const before=current,selection=host.getSelection(),credential=token;
  if(!selection||!getSession()||!credential)return null;
  const {data,error}=await auth.getUser(credential);
  if(error||data?.user?.id!==before.userId||data.user.is_anonymous!==false){if(current===before)clear();return null}
  if(current!==before||!getSession()||host.getSelection()?.membershipId!==selection.membershipId||host.getSelection()?.planId!==selection.planId)return null;
  return {membershipId:selection.membershipId,accessToken:credential};
 }});
 const host=createPersonalBpmHost({client,getSession,subscribeSession:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)},enabled});
 async function verify(session,g){
  if(!enabled||closed||g!==generation)return;
  try{
   const credential=session?.access_token,expiry=Number(session?.expires_at)*1000;
   if(typeof credential!=='string'||!/^[-\\w]+\\.[-\\w]+\\.[-\\w]+$/.test(credential)||!Number.isFinite(expiry)||expiry<=Date.now())return;
   const {data,error}=await auth.getUser(credential);
   if(closed||g!==generation||error||data?.user?.id!==session.user?.id||data?.user?.is_anonymous!==false||expiry<=Date.now())return;
   current=Object.freeze({userId:data.user.id,sessionEpoch:String(g)});token=credential;expires=expiry;
   timer=setTimeout(()=>{if(g===generation)clear()},Math.min(expiry-Date.now(),2147483647));timer.unref?.();
  }catch{if(g===generation)clear()}
 }
 const {data:{subscription}}=auth.onAuthStateChange((event,session)=>{
  if(closed)return;clear();const g=generation;
  // Do not await Auth API calls inside the SDK's state-change callback.
  if(session&&event!=='SIGNED_OUT')setTimeout(()=>void verify(session,g),0);
 });
 function dispose(){if(closed)return;closed=true;clear();try{host.dispose()}finally{subscription.unsubscribe();listeners.clear()}}
 return Object.freeze({host,getSession,dispose});
}
module.exports={createAuthPersonalBpmHost};
