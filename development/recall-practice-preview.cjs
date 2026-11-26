'use strict';
// Isolated synthetic preview only. No authentication, real athlete data or score uploads.
(function(){
 const $=id=>document.getElementById(id);
 const copy={
 es:{subtitle:'Entrenamiento personalizado',level:'NIVEL',rounds:'RONDAS',correct:'ACIERTOS',start:'Comenzar',next:'Otra ronda',stop:'Detener',idle:'Listo para practicar',watch:'Memoriza la secuencia',respond:'Repite la secuencia',success:'¡Correcto!',retry:'Inténtalo de nuevo',note:'Vista de prueba · BPM simulado de 84 · Sin datos de atletas ni resultados de competencia.',cell:'Casilla',board:'Tablero de memoria'},
 en:{subtitle:'Personalized practice',level:'LEVEL',rounds:'ROUNDS',correct:'CORRECT',start:'Start',next:'Next round',stop:'Stop',idle:'Ready to practice',watch:'Memorize the sequence',respond:'Repeat the sequence',success:'Correct!',retry:'Try again',note:'Test preview · Simulated 84 BPM · No athlete data or competition results.',cell:'Cell',board:'Memory board'}
 };
 let lang='es',state=null;const cells=[];
 for(let i=0;i<25;i++){const b=document.createElement('button');b.type='button';b.className='cell';b.disabled=true;b.addEventListener('click',()=>host.tap(i));$('court').appendChild(b);cells.push(b)}
 function render(s){
  state=s;const t=copy[lang];document.documentElement.lang=lang;
  $('language').textContent=lang==='es'?'EN':'ES';$('language').setAttribute('aria-label',lang==='es'?'English':'Español');
  $('subtitle').textContent=t.subtitle;$('levelLabel').textContent=t.level;$('roundLabel').textContent=t.rounds;$('correctLabel').textContent=t.correct;
  $('tempo').textContent=(s.bpm??'—')+' BPM';$('level').textContent=s.level;$('rounds').textContent=s.rounds;$('correct').textContent=s.correct;
  $('status').textContent=t[s.phase==='correct'?'success':s.phase]||t.idle;$('note').textContent=t.note;$('court').setAttribute('aria-label',t.board);
  $('start').textContent=s.phase==='correct'||s.phase==='retry'?t.next:t.start;$('start').disabled=s.bpm===null||!['idle','correct','retry'].includes(s.phase);
  $('stop').textContent=t.stop;$('stop').disabled=s.phase==='idle';
  cells.forEach((b,i)=>{b.classList.toggle('lit',s.visible===i);b.disabled=s.phase!=='respond';b.setAttribute('aria-label',t.cell+' '+(i+1));b.setAttribute('aria-pressed',String(s.visible===i))});
 }
 const host=createRecallPractice({onState:render});
 const adapter=createRecallBpmAdapter({host});
 // Deliberately synthetic fixed prescription; not a substitute for verified BPM.
 adapter.apply({bpm:84,planId:'00000000-0000-4000-8000-000000000084'});
 $('language').addEventListener('click',()=>{lang=lang==='es'?'en':'es';render(state)});
 $('start').addEventListener('click',()=>host.start());
 $('stop').addEventListener('click',()=>host.cancelPractice());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)host.cancelPractice()});
 window.addEventListener('pagehide',()=>adapter.clear());
 window.addEventListener('pageshow',e=>{if(e.persisted&&!adapter.getTiming())adapter.apply({bpm:84,planId:'00000000-0000-4000-8000-000000000084'})});
})();
