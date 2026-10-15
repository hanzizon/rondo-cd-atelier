// One media clock for both picture and sound. Audio is already mastered at
// 20% with the 4s/5s loop fades; gain also balances quieter source recordings.
export const video=document.createElement('video');
const tracks={'rondo-6':'traumerei-av.mp4','amaoto':'amaoto-av.mp4','amaoto-limited':'amaoto-av.mp4','rondo-4':'black-lotus-av.mp4','fukai-mori':'fukai-mori-av.mp4','killing-me':'killing-me-av.mp4','rondo-hana':'hana-av.mp4','rondo-revolution':'revolution.m4a'};
let currentTrack=null,desiredTrack=null,switchTimer,switching=false,playing=false;
video.loop=true;
video.playsInline=true;
video.preload='auto';
video.setAttribute('playsinline','');
video.setAttribute('webkit-playsinline','');
let selected=false,wanted=false,mv=true,ctx,gain,stopTimer,frame;
let opacity=0,opacityCallback=()=>{},revision=0;
export function bindVideoOpacity(fn){opacityCallback=fn;}
function unlock(){
  try {
    if(!ctx){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      ctx=new AudioContext();gain=ctx.createGain();gain.gain.value=0;
      ctx.createMediaElementSource(video).connect(gain).connect(ctx.destination);
    }
    ctx.resume().catch(()=>{});
  } catch {}
}
// Balance the seven active recordings to approximately -24 dBFS mean.
const trackGainDb={'fukai-mori-av.mp4':15,'amaoto-av.mp4':6,'hana-av.mp4':5,'black-lotus-av.mp4':1,'revolution.m4a':1.5};
function envelope(on){
  if(!gain)return;
  const t=ctx.currentTime,p=gain.gain;
  if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);
  else {const value=p.value;p.cancelScheduledValues(t);p.setValueAtTime(value,t);}
  const level=10**((trackGainDb[currentTrack]??0)/20);
  p.linearRampToValueAtTime(on?level:0,t+1);
}
function visual(target=selected&&wanted&&mv&&playing&&!switching&&currentTrack?.endsWith('.mp4')?.90:0){
  cancelAnimationFrame(frame);
  const from=opacity,start=performance.now();
  function tick(t){
    const progress=Math.min(1,(t-start)/1000);
    opacity=from+(target-from)*progress;opacityCallback(opacity);
    if(progress<1)frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
}
export function toggleMV(){mv=!mv;visual();return mv;}
function commitTrack(next){
  video.pause();playing=false;currentTrack=next;selected=Boolean(next);
  opacity=0;opacityCallback(0);
  if(next){video.src=new URL('./audio/'+next,import.meta.url).href;video.load();}
  else video.currentTime=0;
}
function beginPlayback(){
  const request=++revision;
  if(selected&&wanted){
    unlock();
    video.play().then(()=>{
      if(request!==revision)return;
      playing=true;envelope(true);visual();
    }).catch(()=>{});
  }else{
    envelope(false);visual();
    stopTimer=setTimeout(()=>{
      if(request===revision&&(!selected||!wanted)){video.pause();playing=false;}
    },1000);
  }
}
export function selectMusic(id,on){
  desiredTrack=tracks[id]||null;wanted=on;
  clearTimeout(stopTimer);clearTimeout(switchTimer);++revision;
  if(desiredTrack===currentTrack){switching=false;beginPlayback();return;}
  if(currentTrack&&playing&&wanted){
    switching=true;envelope(false);visual(0);
    switchTimer=setTimeout(()=>{
      switching=false;cancelAnimationFrame(frame);
      commitTrack(desiredTrack);beginPlayback();
    },1000);
  }else{
    switching=false;cancelAnimationFrame(frame);
    commitTrack(desiredTrack);beginPlayback();
  }
}
export function syncMusic(on){
  wanted=on;clearTimeout(stopTimer);
  if(switching){
    if(on)return;
    clearTimeout(switchTimer);switching=false;cancelAnimationFrame(frame);
    commitTrack(desiredTrack);
  }
  beginPlayback();
}
