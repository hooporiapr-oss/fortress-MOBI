'use strict';
// Development UI adapter. Requires an explicitly supplied authenticated controller.
// No legacy name-based identity, local storage, or automatic production activation.
const T={
 en:{title:'Coach Memory',notice:'Select a verified enrollment to save or review training plans.',save:'Save training plan',history:'Training history',more:'Load more',empty:'No saved training plans.',saved:'Plan saved.',loading:'Loading…',saving:'Saving…',error:'Request failed. Verify access or retry.',ready:'Ready',stage:'Developmental stage',days:'Days per week',stations:'Stations',date:'Effective date',review:'Review previous plan',retry:'Retry the same save before changing the plan.'},
 es:{title:'Memoria del entrenador',notice:'Seleccione una membresía verificada para guardar o consultar planes.',save:'Guardar plan',history:'Historial de entrenamiento',more:'Cargar más',empty:'No hay planes guardados.',saved:'Plan guardado.',loading:'Cargando…',saving:'Guardando…',error:'No se completó la solicitud. Verifique el acceso o reintente.',ready:'Listo',stage:'Etapa de desarrollo',days:'Días por semana',stations:'Estaciones',date:'Fecha de vigencia',review:'Consultar plan anterior',retry:'Reintente el mismo guardado antes de cambiar el plan.'}
};
function mountCoachMemoryPanel({root,controller,getDraft,randomUUID=()=>globalThis.crypto.randomUUID(),language='es'}={}){
 if(!root||!controller||typeof getDraft!=='function')throw Error('Panel configuration required');
 const doc=root.ownerDocument;let lang=language==='en'?'en':'es',epoch=0,busy=false,pending=null,records=[],cursor=null,closed=false,lastScope=null,status='ready';
 const el=(tag)=>doc.createElement(tag);
 const title=el('h3'),notice=el('p'),save=el('button'),history=el('button'),more=el('button'),message=el('p'),list=el('div');
 for(const b of [save,history,more])b.type='button';
 message.setAttribute('role','status');list.setAttribute('aria-live','polite');
 root.replaceChildren(title,notice,save,history,message,list,more);
 function scope(){const s=controller.state();return s.enabled&&s.authenticated&&s.membershipId?s.membershipId:null}
 function reset(){epoch++;busy=false;pending=null;records=[];cursor=null;status='ready';list.replaceChildren()}
 function sync(){const current=scope();if(current!==lastScope){reset();lastScope=current}render()}
 function render(){const t=T[lang],active=!!scope()&&!closed;title.textContent=t.title;notice.textContent=t.notice;save.textContent=t.save;history.textContent=t.history;more.textContent=t.more;save.disabled=!active||busy;history.disabled=!active||busy;more.hidden=!cursor;more.disabled=!active||busy;message.textContent=t[status]||t.error;
 list.replaceChildren();if(!active)return;
 for(const r of records){const d=el('details'),summary=el('summary'),p=el('p');summary.textContent=t.review+' · '+r.effective_on;p.textContent=[t.stage+': '+r.payload.stage,t.days+': '+r.payload.days,t.stations+': '+r.payload.stations.join(', ')].join(' · ');d.append(summary,p);list.append(d)}
 }
 function validRecord(r){return r&&r.kind==='training_plan'&&typeof r.id==='string'&&typeof r.effective_on==='string'&&typeof r.recorded_at==='string'&&r.payload&&typeof r.payload.stage==='string'&&Number.isInteger(r.payload.days)&&Array.isArray(r.payload.stations)&&r.payload.stations.every(s=>typeof s==='string')}
 async function run(kind,append=false){sync();if(closed||busy||!scope())return;const g=epoch,m=scope();busy=true;status=kind==='save'?'saving':'loading';render();
 try{if(kind==='save'){const draft=getDraft();if(!draft)throw Error('Missing plan');const clean={effectiveOn:draft.effectiveOn,stage:draft.stage,days:draft.days,stations:[...draft.stations]};const key=JSON.stringify(clean);
 if(pending&&pending.key!==key){status='retry';return}if(!pending)pending={key,requestId:randomUUID(),draft:clean};
 await controller.savePlan({...pending.draft,requestId:pending.requestId});if(g!==epoch||scope()!==m||closed)return;pending=null;status='saved';
 }else{const page=await controller.history(append&&cursor?{beforeTime:cursor.time,beforeId:cursor.id}:{});if(g!==epoch||scope()!==m||closed)return;
 const incoming=page.records.filter(validRecord);records=append?[...records,...incoming.filter(r=>!records.some(a=>a.id===r.id))]:incoming;
 const last=page.records.at(-1);cursor=page.records.length===25&&last?.recorded_at&&last?.id?{time:last.recorded_at,id:last.id}:null;status=records.length?'ready':'empty';
 }}catch{if(g===epoch&&scope()===m&&!closed)status='error'}finally{if(g===epoch&&!closed){busy=false;sync()}}
 }
 save.onclick=()=>void run('save');history.onclick=()=>void run('history');more.onclick=()=>void run('history',true);
 sync();
 return Object.freeze({refresh(){reset();lastScope=scope();render()},setLanguage(value){lang=value==='en'?'en':'es';sync()},dispose(){closed=true;reset();root.replaceChildren();save.onclick=history.onclick=more.onclick=null}});
}
module.exports={mountCoachMemoryPanel};
