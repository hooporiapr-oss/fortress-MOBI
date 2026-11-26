'use strict';
// Development preview: personal mode is enabled only by an explicit trusted host.
(function(){
 const $=id=>document.getElementById(id),dots=[...document.querySelectorAll('.beat')];
 const words={es:{subtitle:'Calentamiento rítmico personal',mode:'Modo',manual:'BPM manual',tapMode:'Marcar tempo',personal:'Mi BPM confirmado',bpm:'Tempo (40–200 BPM)',tap:'Marca cuatro pulsos',duration:'Duración',free:'Libre',start:'Comenzar',stop:'Detener',idle:'Listo',running:'En ritmo',completed:'Calentamiento completado',error:'Audio no disponible o interrumpido',note:'Vista de desarrollo. Tempo manual o marcado; sin datos de atletas ni puntuación. El BPM confirmado requiere un acceso autorizado.'},en:{subtitle:'Personal rhythm warm-up',mode:'Mode',manual:'Manual BPM',tapMode:'Tap tempo',personal:'My confirmed BPM',bpm:'Tempo (40–200 BPM)',tap:'Tap four beats',duration:'Duration',free:'Free',start:'Start',stop:'Stop',idle:'Ready',running:'In rhythm',completed:'Warm-up completed',error:'Audio unavailable or interrupted',note:'Development preview. Manual or tapped tempo; no athlete data or scoring. Confirmed BPM requires authorized access.'}};
 const host=window.ritnomePersonalHost;
 const personalEnabled=host?.enabled===true&&typeof host.getSelection==='function'&&typeof host.subscribeSelection==='function'&&typeof host.client?.request==='function'&&typeof host.client?.invalidate==='function'&&typeof createAuthenticatedRitnome==='function';
 let personal=null,personalBpm=null;
 let lang='es',context=null,audio=null,clock=null,starting=false,epoch=0,status='idle',taps=[],tapBpm=null;
 function render(){
  const w=words[lang],s=clock?.snapshot(),busy=starting||s?.state==='running',mode=$('mode').value;
  document.documentElement.lang=lang;$('language').textContent=lang==='es'?'EN':'ES';
  for(const [id,k] of Object.entries({subtitle:'subtitle',modeLabel:'mode',manual:'manual',tapMode:'tapMode',personal:'personal',bpmLabel:'bpm',tap:'tap',durationLabel:'duration',free:'free',start:'start',stop:'stop',note:'note'}))$(id).textContent=w[k];
  $('bpm').disabled=busy||mode!=='manual';$('mode').disabled=busy;$('duration').disabled=busy;$('tap').hidden=mode!=='tap';$('tap').disabled=busy;
  $('personal').disabled=!personalEnabled;
  const value=mode==='personal'?personalBpm:mode==='tap'?tapBpm:Number($('bpm').value),valid=Number.isInteger(value)&&value>=40&&value<=200;
  $('tempo').textContent=(valid?value:'—')+' BPM';$('start').disabled=busy||(mode==='personal'?!personalEnabled:!valid);$('stop').disabled=!busy;
  $('remaining').textContent=s?.remainingSeconds!=null?Math.ceil(s.remainingSeconds)+' s':'—';$('status').textContent=w[status];
 }
 function stop(reason='stopped'){epoch++;starting=false;if(personal){personal.stop();personalBpm=null}else clock?.stop(reason);dots.forEach(x=>x.classList.remove('on'));status=reason==='completed'?'completed':'idle';render()}
 async function start(){
  if(starting||clock?.snapshot().state==='running'||document.hidden)return;
  const mode=$('mode').value,bpm=mode==='tap'?tapBpm:Number($('bpm').value),duration=$('duration').value==='free'?null:Number($('duration').value);
  if(mode==='personal'?!personalEnabled:(!['manual','tap'].includes(mode)||!Number.isInteger(bpm)||bpm<40||bpm>200))return;
  const g=++epoch;starting=true;render();
  try{
   if(!context){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Audio unsupported');context=new A();audio=createRitnomeAudio(context);clock=createRitnomeClock({audio,now:()=>context.currentTime,outputTimestamp:()=>context.getOutputTimestamp?.(),onBeat:e=>dots.forEach((d,i)=>d.classList.toggle('on',i===e.beatIndex%4)),onState:(s,reason)=>{if(reason==='completed')status='completed';else if(['clock_interrupted','audio_error'].includes(reason))status='error';else if(s.state==='running')status='running';if(s.state==='idle')dots.forEach(d=>d.classList.remove('on'));render()}});const ownedContext=context;ownedContext.addEventListener?.('statechange',()=>{if(context===ownedContext&&ownedContext.state!=='running'&&clock?.snapshot().state==='running')stop()})}
   await context.resume();if(g!==epoch||document.hidden)return;
   if(context.state!=='running')throw Error('Audio suspended');if(mode==='personal'){
    if(!personal)personal=createAuthenticatedRitnome({clock,client:host.client,getSelection:host.getSelection,subscribeSelection:fn=>host.subscribeSelection(()=>{epoch++;starting=false;personalBpm=null;fn();status='idle';render()}),enabled:true});
    const config=await personal.launch();if(g!==epoch||document.hidden)return;
    personalBpm=config.bpm;personal.start(duration);
   }else{
    if(personal){personal.dispose();personal=null;personalBpm=null}
    clock.configure({bpm,source:mode});clock.start(duration);
   }
   starting=false;render();
  }catch{if(g===epoch){stop();status='error';render()}}
 }
 $('language').addEventListener('click',()=>{lang=lang==='es'?'en':'es';render()});
 $('mode').addEventListener('change',()=>{if(personal){personal.dispose();personal=null;personalBpm=null}taps=[];tapBpm=null;status='idle';render()});
 $('bpm').addEventListener('input',render);
 $('tap').addEventListener('click',()=>{const n=performance.now();if(taps.length&&(n-taps.at(-1)>1500||n-taps.at(-1)<300)){taps=[];tapBpm=null}taps.push(n);if(taps.length>4)taps.shift();if(taps.length===4){const v=Math.round(180000/(taps[3]-taps[0]));tapBpm=v>=40&&v<=200?v:null}render()});
 $('start').addEventListener('click',start);$('stop').addEventListener('click',()=>stop());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 window.addEventListener('pagehide',()=>{stop();personal?.dispose();personal=null;personalBpm=null;audio?.dispose();context?.close().catch(()=>{});context=null;audio=null;clock=null});
 render();
})();
