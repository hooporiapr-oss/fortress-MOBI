'use strict';
// Ritnome original synthesized three-conga groove, extracted from
// cognitivo-gym-paradiso/ritnome-congas.html. No recorded samples.
// Single maintained source; no storage, identity, or network access.
function createRitnomeAudio(context,{volume=.45}={}){
 if(!context||!Number.isFinite(volume)||volume<0||volume>.55)throw Error('Invalid audio configuration');
 var SR=44100, actx=context, BUF=null;
var F0=[178,233,311];
var MODES=[[1.00,1.00,1.0],[1.59,.55,.55],[2.14,.32,.40],[2.30,.22,.35],[2.65,.14,.28],[2.92,.09,.22]];
var KIND={open:{dur:.55,dec:.20},slap:{dur:.22,dec:.045},tip:{dur:.08,dec:.018},heel:{dur:.09,dec:.022}};
var seed=7;function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647}
function bandNoise(n,f0,q){   // short noise through a band-pass (the hand on the skin)
  var out=new Float32Array(n),w=2*Math.PI*f0/SR,al=Math.sin(w)/(2*q),b0=al,b2=-al,a0=1+al,a1=-2*Math.cos(w),a2=1-al,x1=0,x2=0,y1=0,y2=0;
  for(var i=0;i<n;i++){var x=rnd()*2-1,y=(b0*x+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;out[i]=y}
  return out;
}
function makeStroke(d,kind,variant){
  var k=KIND[kind],n=Math.floor(SR*k.dur),y=new Float32Array(n),f0=F0[d]*(1+(variant-.5)*.008);
  for(var m=0;m<MODES.length;m++){
    var r=MODES[m][0],a=MODES[m][1],dk=MODES[m][2],ph=rnd()*6.28,tau=k.dec*dk;
    for(var i=0;i<n;i++){var t=i/SR,bend=1+.06*Math.exp(-t/.015);ph+=2*Math.PI*f0*r*bend/SR;y[i]+=a*Math.sin(ph)*Math.exp(-t/tau)}
  }
  for(var i=0;i<n;i++)y[i]*=1-Math.exp(-(i/SR)/.0012);
  var nm,amp,fc,td;
  if(kind==='slap'){nm=.06;amp=2.4;fc=3000;td=.012;for(var i=0;i<n;i++)y[i]*=.8}
  else if(kind==='open'){nm=.02;amp=.5;fc=1800;td=.004}
  else{nm=.015;amp=.4;fc=1300;td=.003}
  var m2=Math.floor(SR*nm),nz=bandNoise(m2,fc,.8);
  for(var i=0;i<m2&&i<n;i++)y[i]+=nz[i]*amp*Math.exp(-(i/SR)/td);
  if(kind==='tip')for(var i=0;i<n;i++)y[i]*=.35;
  if(kind==='heel')for(var i=0;i<n;i++)y[i]*=.45;
  var b=actx.createBuffer(1,n,SR);b.copyToChannel?b.copyToChannel(y,0):b.getChannelData(0).set(y);return b;
}
function buildSounds(){   // two takes of every stroke on every drum, so it breathes like real hands
  BUF={};['open','slap','tip','heel'].forEach(function(k){BUF[k]=[0,1,2].map(function(d){return [makeStroke(d,k,.2),makeStroke(d,k,.8)]})});
}

 var TUMBAO=[[0,'heel',.7],[2,'tip',.6],[4,'slap',.9],[6,'tip',.6],[8,'heel',.7],[10,'tip',.6],[12,'open',.85],[14,'open',.85]];
function barEvents(k){
  var ev=[],last=k%4===3;
  for(var q=0;q<4;q++)if(!(last&&q===3))ev.push([q*4,0,'open',.95]);            // tumba: the pulse
  TUMBAO.forEach(function(e){if(!(last&&e[0]>=12))ev.push([e[0],1,e[1],e[2]])}); // conga: tumbao
  [3,6,11,14].forEach(function(p){if(!(last&&p>=12))ev.push([p,2,'slap',.75])});  // quinto: dembow accents
  if(k%2===1&&!last){ev.push([15,2,'open',.55]);ev.push([15.5,2,'slap',.65])}    // short roll into the next bar
  if(last){                                                                        // big roll across the three drums
    for(var i=0;i<8;i++){var d=[2,2,2,1,1,1,0,0][i];ev.push([12+i*.5,d,i%2?'slap':'open',.4+.6*i/7])}
  }
  return ev;
}

 const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=3;
 const master=context.createGain();master.gain.value=volume;master.connect(compressor);compressor.connect(context.destination);
 const active=new Set();let closed=false;
 function prepare(){if(closed)throw Error('Audio closed');if(!BUF)buildSounds()}
 function scheduleStep(step,when,sixteenth){
  if(closed||!BUF||!Number.isInteger(step)||step<0||!Number.isFinite(when)||!Number.isFinite(sixteenth)||sixteenth<=0)throw Error('Invalid audio schedule');
  const inBar=step%16;
  for(const e of barEvents(Math.floor(step/16))){
   if(e[0]<inBar||e[0]>=inBar+1)continue;
   const node=context.createBufferSource(),gain=context.createGain();
   node.buffer=BUF[e[2]][e[1]][rnd()<.5?0:1];gain.gain.value=e[3]*(.93+rnd()*.12);
   node.connect(gain);gain.connect(master);const item={node,gain};active.add(item);
   node.onended=()=>{active.delete(item);node.disconnect();gain.disconnect()};
   try{node.start(when+(e[0]-inBar)*sixteenth)}catch(err){active.delete(item);node.disconnect();gain.disconnect();throw err}
  }
 }
 function cancel(){for(const item of active){item.node.onended=null;try{item.node.stop()}catch{}item.node.disconnect();item.gain.disconnect()}active.clear()}
 function dispose(){if(closed)return;closed=true;cancel();master.disconnect();compressor.disconnect();BUF=null}
 return Object.freeze({prepare,scheduleStep,cancel,dispose});
}
if(typeof module!=='undefined')module.exports={createRitnomeAudio};
