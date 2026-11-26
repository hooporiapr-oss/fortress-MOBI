const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('coach.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
script.forEach(s=>new vm.Script(s));
const src=script.find(s=>s.includes('function poStats'));
const block=src.slice(src.indexOf("var poSource='loading';"),src.indexOf("['poPeriod','poPlatform','poCategory'].forEach"));
const c={LANG:'es',players:{},CG:{},TEAMSOK:null,TEAM:'',TEAMOF:{},teamOf(n){return c.TEAMOF[n.toLowerCase()]||''},inTeam(n){return !c.TEAM||c.teamOf(n)===c.TEAM}};
vm.createContext(c);vm.runInContext(block,c);
const now='2026-11-26T16:00:00Z';
const row=(key,platform,station,unit,mode,at,value,team='A',category='5')=>({key,platform,station,unit,mode,at,day:c.poDay(at),value,team,category});
const data=[row('a','hm','recall','level','','2026-11-25T12:00:00Z',2),row('a','hm','recall','level','','2026-11-26T12:00:00Z',4),row('a','rv','zn','hits',10,'2026-11-26T13:00:00Z',7),row('a','rv','zn','hits',25,'2026-11-26T14:00:00Z',18),row('b','rv','rv','bpm','','2026-11-26T12:00:00Z',80,'B','6'),row('b','cg','rs','bpm','','2026-11-26T13:00:00Z',60,'B','6'),row('c','hm','recall','level','','2026-10-01T12:00:00Z',1),row('d','hm','recall','level','','2026-11-26T18:00:00Z',1)];
let x=c.poStats(data,7,'all','',now);assert.equal(x.attempts,6);assert.equal(x.active,2);assert.equal(x.repeat,1);assert.equal(x.days,2);assert.equal(x.stations.find(s=>s.station==='recall').change,2);assert.equal(x.stations.filter(s=>s.station==='zn').length,2);assert.ok(x.stations.filter(s=>s.station==='zn').every(s=>s.change===null));assert.equal(c.poStats(data,7,'rv','',now).attempts,3);assert.equal(c.poStats(data,7,'cg','',now).attempts,1);assert.equal(c.poStats(data,7,'hm','5',now).attempts,2);assert.equal(c.poStats(data,90,'all','',now).active,3);assert.equal(c.poDay('2026-11-26T02:00:00Z'),'2026-11-25');
c.TEAMOF={a:'A',b:'B'};c.TEAMSOK=['A'];c.players={a:{name:'A',games:{recall:[{v:2,at:now}]}},b:{name:'B',games:{recall:[{v:9,at:now}]}}};assert.equal(c.poRecords().length,1);assert.equal(c.poT('title'),'Resumen del programa');c.LANG='en';assert.equal(c.poT('title'),'Program Overview');
console.log('PASS: syntax, dates, unique athletes, periods, recurrence, shared stations, categories, units, permission filter and ES/EN');

function loadPart(start,end){let a=src.indexOf(start),b=src.indexOf(end,a);assert.ok(a>=0&&b>a);vm.runInContext(src.slice(a,b),c);}
loadPart('var PO_MONTH=','$(\'poMonthToggle\').onclick');
loadPart('var AP_TEXT=','$(\'apSelect\').onchange');
loadPart('var TP_TEXT=','$(\'tpBpm\').oninput');
loadPart('var PA_TEXT=','$(\'paPeriod\').onchange');
let m=c.poMonthBounds('2026-11',now);assert.equal(m.end,'2026-11-26');assert.equal(m.prevEnd,'2026-10-26');assert.equal(c.poMonthBounds('2024-02',now).end,'2024-02-29');
let ap=c.apStats(data,now);assert.equal(ap.current,80);assert.equal(ap.baseline,80);assert.equal(ap.attempts,6);
let plan=c.tpBuild(ap,120,3,'balanced');assert.equal(plan.days.length,3);assert.ok(plan.days.some(d=>d.rhythm.length));assert.ok(c.tpBuild(ap,null,3,'balanced').days.every(d=>!d.rhythm.length));
let samples=[row('a','rv','rv','bpm','','2026-11-13T12:00:00Z',90),row('a','rv','rv','bpm','','2026-11-14T12:00:00Z',110),row('a','rv','rv','bpm','','2026-11-20T12:00:00Z',120),row('a','rv','rv','bpm','','2026-11-21T12:00:00Z',128),row('a','rv','rv','bpm','','2026-11-26T12:00:00Z',900),row('a','rv','zn','hits',10,'2026-11-20T12:00:00Z',8)];
let assess=c.paStats(samples,7,now);let st=assess.stations.find(s=>s.station==='rv');assert.equal(st.before,100);assert.equal(st.after,124);assert.equal(st.change,24);assert.equal(st.pct,24);assert.equal(assess.stations.find(s=>s.station==='zn').change,null);assert.equal(assess.after[1],'2026-11-25');
console.log('PASS: monthly boundaries, athlete profile, confirmed BPM planner and equal-period progress assessment');
