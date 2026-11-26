'use strict';
// Development-only host boundary. No browser storage, names, or implicit login.
// The caller must provide a verified session snapshot and explicit plan selection.
function createPersonalBpmHost({client, getSession, subscribeSession, enabled=false}={}){
 if(!client||typeof client.request!=='function'||typeof client.invalidate!=='function'||typeof getSession!=='function'||typeof subscribeSession!=='function')throw Error('Invalid personal BPM host');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 let selected=null,closed=false;const listeners=new Set();
 function current(){try{const s=getSession();return s&&uuid(s.userId)&&typeof s.sessionEpoch==='string'&&s.sessionEpoch.length>0?{userId:s.userId,sessionEpoch:s.sessionEpoch}:null}catch{return null}}
 function same(a,b){return !!a&&!!b&&a.userId===b.userId&&a.sessionEpoch===b.sessionEpoch}
 function clear(){selected=null;try{client.invalidate()}finally{for(const fn of [...listeners]){try{fn()}catch{}}}}
 const unsub=subscribeSession(clear);if(typeof unsub!=='function')throw Error('Session unsubscribe required');
 function select({membershipId,planId}={}){
  clear();const s=current();if(!enabled||closed||!s||!uuid(membershipId)||!uuid(planId))throw Error('Authorized selection required');
  selected=Object.freeze({...s,membershipId,planId});return getSelection();
 }
 function getSelection(){if(!enabled||closed||!selected||!same(selected,current()))return null;const {membershipId,planId,sessionEpoch}=selected;return Object.freeze({membershipId,planId,sessionEpoch})}
 function subscribeSelection(fn){if(closed||typeof fn!=='function')throw Error('Invalid selection listener');listeners.add(fn);return ()=>listeners.delete(fn)}
 const scopedClient=Object.freeze({invalidate:()=>client.invalidate(),async request(action,fields){const before=selected,s=getSelection();if(!s||action!=='get_bpm_plan'||fields?.plan_id!==s.planId||fields?.station!=='ritnome'||Object.keys(fields).some(k=>!['plan_id','station'].includes(k)))throw Error('Authorized Ritnome plan required');const data=await client.request(action,{plan_id:s.planId,station:'ritnome'});if(before!==selected||!getSelection()||data?.prescription?.membership_id!==s.membershipId||data?.prescription?.plan_id!==s.planId||data?.prescription?.station!=='ritnome')throw Error('Selection changed or incompatible prescription');return data}});
 function dispose(){if(closed)return;closed=true;try{clear()}finally{listeners.clear();unsub()}}
 return Object.freeze({enabled:enabled===true,client:scopedClient,getSelection,subscribeSelection,select,clear,dispose});
}
if(typeof module!=='undefined')module.exports={createPersonalBpmHost};
