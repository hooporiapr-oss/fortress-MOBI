'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('coach.html','utf8');
const nodes={};
for(const id of ['cmBpmTitle','cmBpmNote','cmBpmLabel','cmBpmSubmit','cmBpmConfirm','cmBpmPlan','cmBpmState','cmBpmValue','cmTitle','cmNote','cmSave','cmHistory','cmState']){
 const tag=html.match(new RegExp('<[^>]+id="'+id+'"[^>]*>'));
 assert.ok(tag,'missing '+id);
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 nodes[id]={disabled:false,value:'84',textContent:''};
 if(['cmBpmSubmit','cmBpmConfirm','cmBpmPlan','cmBpmValue','cmSave','cmHistory'].includes(id))assert.match(tag[0],/\bdisabled\b/);
}
const begin=html.indexOf('var CM_TEXT='),end=html.indexOf('var FROM=',begin);
assert.ok(begin>=0&&end>begin);
const context=vm.createContext({LANG:'es',TP_PLAN:null,$:id=>nodes[id]});
vm.runInContext(html.slice(begin,end),context);
for(const lang of ['es','en']){
 context.LANG=lang;context.TP_PLAN={bpm:84};
 nodes.cmBpmValue.value='84';
 vm.runInContext('cmPreviewRender()',context);
 assert.equal(nodes.cmBpmTitle.textContent,lang==='es'?'BPM personal':'Personal BPM');
 assert.equal(nodes.cmBpmValue.value,'');
 for(const id of ['cmBpmSubmit','cmBpmConfirm','cmBpmPlan','cmBpmValue','cmSave','cmHistory'])assert.equal(nodes[id].disabled,true);
 assert.ok(nodes.cmBpmNote.textContent.includes(lang==='es'?'No se guardan':'No data is saved'));
}
assert.match(html,/applyLang\(\);cmPreviewRender\(\);poRender\(\)/);
console.log('PASS: bilingual disabled BPM preview, language refresh and cleared input');
