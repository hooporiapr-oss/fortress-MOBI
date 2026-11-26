'use strict';
// Synthetic isolated preview. No real athlete identity, authentication or score uploads.
(function(){
 const $=id=>document.getElementById(id);
 const copy={
 es:{subtitle:'Entrenamiento personalizado',level:'NIVEL',rounds:'RONDAS',correct:'ACIERTOS',start:'Comenzar',next:'Otra ronda',stop:'Detener',idle:'Listo para practicar',watch:'Memoriza el patrón original',transition:'Prepárate para el eco',echo:'Observa el patrón modificado',finding:'Toca la posición que cambió',success:'¡Correcto!',retry:'Inténtalo de nuevo',note:'Vista de prueba · BPM simulado de 84 · Sin datos de atletas ni resultados de competencia.',cell:'Casilla',board:'Tablero de reconocimiento',position:'Posición'},
 en:{subtitle:'Personalized practice',level:'LEVEL',rounds:'ROUNDS',correct:'CORRECT',start:'Start',next:'Next round',stop:'Stop',idle:'Ready to practice',watch:'Memorize the original pattern',transition:'Get ready for the echo',echo:'Watch the modified pattern',finding:'Tap the changed position',success:'Correct!',retry:'Try again',note:'Test preview · Simulated 84 BPM · No athlete data or competition results.',cell:'Cell',board:'Recognition board',position:'Position'}
 };
 let lang='es',state=null;const cells=[];
 for(let i=0;i<25;i++){const b=document.createElement('button');b.type='button';b.className='cell';b.disabled=true;b.addEventListener('click',()=>host.tap(i));$('court').appendChild(b);cells.push(b)}
 function render(s){
  state=s;const t=copy[lang];document.documentElement.lang=lang;
  $('language').textContent=lang==='es'?'EN':'ES';$('language').setAttribute('aria-label',lang==='es'?'English':'Español');
  $('subtitle').textContent=t.subtitle;$('levelLabel').textContent=t.level;$('roundLabel').textContent=t.rounds;$('correctLabel').textContent=t.correct;
  $('tempo').textContent=(s.bpm??'—')+' BPM';$('level').textContent=s.level;$('rounds').textContent=s.rounds;$('correct').textContent=s.correct;
  $('status').textContent=t[s.phase==='correct'?'success':s.phase]||t.idle;$('note').textContent=t.note;$('court').setAttribute('aria-label',t.board);
  $('start').textContent=['correct','retry'].includes(s.phase)?t.next:t.start;$('start').disabled=s.bpm===null||!['idle','correct','retry'].includes(s.phase);
  $('stop').textContent=t.stop;$('stop').disabled=s.phase==='idle';
  cells.forEach((b,i)=>{
   const active=s.visible===i,choice=s.phase==='finding'?s.choices.indexOf(i):-1;
   const number=active?s.ordinal:choice>=0?choice+1:null;
   b.classList.toggle('lit',active&&s.phase==='watch');
   b.classList.toggle('echo',active&&s.phase==='echo');
   b.classList.toggle('choice',choice>=0);
   b.textContent=number===null?'':String(number);
   b.disabled=choice<0;
   b.setAttribute('aria-label',t.cell+' '+(i+1)+(number===null?'':', '+t.position+' '+number));
  });
 }
 const host=createRecognitionPractice({onState:render});
 const adapter=createRecognitionBpmAdapter({host});
 const synthetic={bpm:84,planId:'00000000-0000-4000-8000-000000000084'};
 adapter.apply(synthetic);
 $('language').addEventListener('click',()=>{lang=lang==='es'?'en':'es';render(state)});
 $('start').addEventListener('click',()=>host.start());
 $('stop').addEventListener('click',()=>host.cancelPractice());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)host.cancelPractice()});
 window.addEventListener('pagehide',()=>adapter.clear());
 window.addEventListener('pageshow',e=>{if(e.persisted&&!adapter.getTiming())adapter.apply(synthetic)});
})();
