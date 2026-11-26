// Builds coach-memory.js for coach.html from the sources in coach-memory/src. Run: node coach-memory/build.cjs
'use strict';
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'src'),read=n=>fs.readFileSync(path.join(dir,n),'utf8');
const names=['coach-memory-client.cjs','auth-coach-memory.cjs','coach-memory-panel.cjs','goal-center-persistence.cjs'];
let out='/* Built by coach-memory/build.cjs — edit the files in coach-memory/src, not this file. */\n(function(){\nconst modules={};function load(name){return modules[name].exports}\n';
for(const n of names)out+='modules["./'+n+'"]={exports:{}};(function(module,require){'+read(n)+'\n})(modules["./'+n+'"],load);\n';
out+='window.__coachMemoryModules={createAuthCoachMemory:load("./auth-coach-memory.cjs").createAuthCoachMemory,mountCoachMemoryPanel:load("./coach-memory-panel.cjs").mountCoachMemoryPanel,createGoalCenterPersistence:load("./goal-center-persistence.cjs").createGoalCenterPersistence};\n})();\n';
out+=read('coach-view-integration.js');
fs.writeFileSync(path.join(__dirname,'..','coach-memory.js'),out);
console.log('coach-memory.js '+out.length+' bytes');
