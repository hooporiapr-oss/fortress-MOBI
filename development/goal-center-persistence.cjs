'use strict';
// Development-only bridge for the existing Goal Center. No name-based identity.
// Station-only v1 goal records cannot safely identify a game mode or scoring unit.
const supported=Object.freeze({weekly:'active_days',reaction:'reaction_bpm'});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=code=>Object.assign(Error('Goal persistence unavailable'),{code});
function createGoalCenterPersistence({controller,randomUUID=()=>globalThis.crypto.randomUUID()}={}){
 if(!controller||typeof controller.saveGoal!=='function'||typeof controller.history!=='function'||typeof controller.state!=='function')throw Error('Controller required');
 let generation=0,pending=null,closed=false,busy=false;
 function scope(){const s=controller.state();return !closed&&s.enabled&&s.authenticated&&uuid(s.membershipId)?s.membershipId:null}
 function invalidate(){generation++;pending=null;busy=false}
 function assertScope(m,g){if(!m||scope()!==m||generation!==g)throw fail('selection_changed')}
 function canPersist(metric){return !!metric&&Object.hasOwn(supported,metric.id)&&Number.isInteger(metric.current)&&metric.current>=0&&Number.isInteger(metric.max)&&metric.max>metric.current}
 async function save({metric,target,effectiveOn}={}){
  const m=scope(),g=generation;if(!m)throw fail('authentication_required');if(busy)throw fail('busy');
  if(!canPersist(metric)||!Number.isInteger(target)||target<=metric.current||target>metric.max||target>99999||(metric.id==='weekly'&&target>7)||typeof effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn))throw fail('invalid_request');
  const draft={metric:supported[metric.id],baseline:metric.current,target,effectiveOn},key=JSON.stringify(draft);
  if(pending&&pending.membership!==m)pending=null;
  if(pending&&pending.key!==key)throw fail('retry_original');
  if(!pending)pending={membership:m,key,requestId:randomUUID()};
  busy=true;try{const result=await controller.saveGoal({...draft,requestId:pending.requestId});assertScope(m,g);if(!uuid(result?.id))throw fail('unavailable');pending=null;return result}
  finally{if(g===generation)busy=false}
 }
 async function load({maxPages=20}={}){
  const m=scope(),g=generation;if(!m)throw fail('authentication_required');if(!Number.isInteger(maxPages)||maxPages<1||maxPages>100)throw fail('invalid_request');
  let cursor=null;const seen=new Set(),latest=new Map();
  for(let i=0;i<maxPages;i++){
   const page=await controller.history({pageSize:100,...(cursor?{beforeTime:cursor.time,beforeId:cursor.id}:{})});assertScope(m,g);
   if(!Array.isArray(page?.records)||page.records.length>100)throw fail('unavailable');
   for(const r of page.records){const p=r?.payload;if(r?.kind!=='goal'||!uuid(r.id)||!p)continue;
    const id=p.metric==='active_days'?'weekly':p.metric==='reaction_bpm'?'reaction':null;
    if(!id||latest.has(id)||!Number.isInteger(p.baseline)||!Number.isInteger(p.target)||p.baseline<0||p.target<=p.baseline||p.target>99999||(id==='weekly'&&p.target>7))continue;
    latest.set(id,{id,start:p.baseline,target:p.target,recordId:r.id,effectiveOn:r.effective_on});
   }
   if(page.records.length<100)return {goals:[...latest.values()],complete:true};
   const last=page.records.at(-1);if(!uuid(last?.id)||typeof last.recorded_at!=='string'||!Number.isFinite(Date.parse(last.recorded_at)))throw fail('unavailable');
   const key=JSON.stringify([last.recorded_at,last.id]);if(seen.has(key))throw fail('unavailable');seen.add(key);cursor={time:last.recorded_at,id:last.id};
  }
  return {goals:[...latest.values()],complete:false};
 }
 return Object.freeze({canPersist,save,load,invalidate,dispose(){closed=true;invalidate()}});
}
module.exports={createGoalCenterPersistence};
