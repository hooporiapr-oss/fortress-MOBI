'use strict';
// Synthetic isolated preview only. No real athlete identity or score uploads.
(function(){
 const $=id=>document.getElementById(id);
 const copy={
 es:{subtitle:'Entrenamiento personalizado',level:'CADENA',rounds:'RONDAS',correct:'ACIERTOS',best:'RÉCORD',start:'Comenzar',next:'Otra ronda',stop:'Detener',idle:'Listo para practicar',watch:'Memoriza la cadena',respond:'Repite la cadena',success:'¡Correcto!',retry:'Inténtalo de nuevo',note:'Vista de prueba · BPM simulado de 84 · Récord de esta sesión solamente · Sin datos de atletas ni resultados de competencia.',cell:'Balón',board:'Cancha de memoria',position:'Posición'},
 en:{subtitle:'Personalized practice',level:'CHAIN',rounds:'ROUNDS',correct:'CORRECT',best:'BEST',start:'Start',next:'Next round',stop:'Stop',idle:'Ready to practice',watch:'Memorize the chain',respond:'Repeat the chain',success:'Correct!',retry:'Try again',note:'Test preview · Simulated 84 BPM · Session best only · No athlete data or competition results.',cell:'Ball',board:'Memory court',position:'Position'}
 };
 let lang='es',state=null;const cells=[];
 for(let i=0;i<5;i++){const b=document.createElement('button');b.type='button';b.className='cell';b.disabled=true;b.addEventListener('click',()=>host.tap(i));$('court').appendChild(b);cells.push(b)}
 function render(s){
  state=s;const t=copy[lang];document.documentElement.lang=lang;
  $('language').textContent=lang==='es'?'EN':'ES';$('language').setAttribute('aria-label',lang==='es'?'English':'Español');
  $('subtitle').textContent=t.subtitle;$('levelLabel').textContent=t.level;$('roundLabel').textContent=t.rounds;$('correctLabel').textContent=t.correct;$('bestLabel').textContent=t.best;
  $('tempo').textContent=(s.bpm??'—')+' BPM';$('level').textContent=s.level;$('rounds').textContent=s.rounds;$('correct').textContent=s.correct;$('best').textContent=s.best;
  $('status').textContent=t[s.phase==='correct'?'success':s.phase]||t.idle;$('note').textContent=t.note;$('court').setAttribute('aria-label',t.board);
  $('start').textContent=['correct','retry'].includes(s.phase)?t.next:t.start;$('start').disabled=s.bpm===null||!['idle','correct','retry'].includes(s.phase);
  $('stop').textContent=t.stop;$('stop').disabled=s.phase==='idle';
  cells.forEach((b,i)=>{
   const active=s.visible===i;
   b.classList.toggle('lit',active);
   b.textContent=active?String(s.ordinal):'';
   b.disabled=s.phase!=='respond';
   b.setAttribute('aria-label',t.cell+' '+(i+1)+(active?', '+t.position+' '+s.ordinal:''));
  });
 }
 const host=createFortressPractice({onState:render});
 const adapter=createFortressBpmAdapter({host});
 const synthetic={bpm:84,planId:'00000000-0000-4000-8000-000000000084'};
 adapter.apply(synthetic);
 $('language').addEventListener('click',()=>{lang=lang==='es'?'en':'es';render(state)});
 $('start').addEventListener('click',()=>host.start());
 $('stop').addEventListener('click',()=>host.cancelPractice());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)host.cancelPractice()});
 window.addEventListener('pagehide',()=>adapter.clear());
 window.addEventListener('pageshow',e=>{if(e.persisted&&!adapter.getTiming())adapter.apply(synthetic)});
})();
