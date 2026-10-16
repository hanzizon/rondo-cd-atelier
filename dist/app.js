import {selectMusic,syncMusic,toggleMV,video,bindVideoOpacity} from './music.js';
import {createStage} from './stage.js';
const $=id=>document.getElementById(id);let paused=false,spin=false,opened=false,ready=false;
let db,albums=[],selected=null,defaults=[];
const orderKey='rondo-album-order-v1';
let savedOrder=[];try{const value=JSON.parse(localStorage.getItem(orderKey)||'[]');if(Array.isArray(value))savedOrder=value.filter(id=>typeof id==='string');}catch{}
const mediaAlbumIds=new Set(["rondo-6","amaoto","amaoto-limited","rondo-4","fukai-mori","killing-me","rondo-hana","rondo-revolution","rondo-8","rondo-13","rondo-2","arcana"]);
const mediaOrderKey='rondo-media-first-20261016-arcana';
let mediaOrderApplied=false;try{mediaOrderApplied=localStorage.getItem(mediaOrderKey)==='1';}catch{}
function restoreOrder(){
 const rank=new Map(savedOrder.map((id,i)=>[id,i]));
 albums.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
 if(defaults.length&&!mediaOrderApplied){
  albums.sort((a,b)=>Number(mediaAlbumIds.has(b.id))-Number(mediaAlbumIds.has(a.id)));
  savedOrder=albums.map(a=>a.id);mediaOrderApplied=true;
  try{localStorage.setItem(orderKey,JSON.stringify(savedOrder));localStorage.setItem(mediaOrderKey,'1');}catch{}
 }
}
function displayName(a){return String(albums.findIndex(x=>x.id===a.id)+1).padStart(2,'0')+' · '+a.name.replace(/^\d+ · /,'');}
function moveAlbum(id,offset){const from=albums.findIndex(a=>a.id===id),to=from+offset;if(from<0||to<0||to>=albums.length)return;const [album]=albums.splice(from,1);albums.splice(to,0,album);savedOrder=albums.map(a=>a.id);try{localStorage.setItem(orderKey,JSON.stringify(savedOrder));$('status').textContent='앨범 순서를 이 브라우저에 저장했습니다.';}catch{$('status').textContent='현재 화면의 순서는 변경했지만 저장하지 못했습니다.';}renderAlbums();document.querySelector('[data-move-id="'+CSS.escape(id)+'"][data-direction="'+offset+'"]')?.focus();}

function loadDefault(){if(ready&&defaults.length&&!selected)apply(defaults[0]);}
const blank=document.createElement('canvas');blank.width=blank.height=64;const blankURL=blank.toDataURL();
const sceneStage=createStage($('stage'),{art:blankURL,artIn:16.2,printOut:0},{getPaused:()=>paused,getSpin:()=>spin,onOpen:on=>{opened=on;$('open').setAttribute('aria-label',on?'케이스 닫기':'케이스 열기');$('open').classList.toggle('on',on);},onReady:()=>{ready=true;loadDefault();},onFail:()=>{$('hint').textContent='3D 화면을 시작하지 못했습니다. WebGL 지원 브라우저에서 다시 열어 주십시오.';}});
sceneStage?.setBackgroundVideo(video);bindVideoOpacity(value=>sceneStage?.setVideoOpacity(value));
function toggleSpin(){spin=!spin;$('spin').classList.toggle('on',spin);$('spin').setAttribute('aria-pressed',String(spin));syncMusic(spin);}
$('open').onclick=()=>sceneStage?.setOpen();$('spin').onclick=toggleSpin;$('spin').setAttribute('aria-pressed','false');$('home').onclick=()=>sceneStage?.resetView();
$('mv').classList.add('on');$('mv').setAttribute('aria-pressed','true');
$('mv').onclick=()=>{const on=toggleMV();$('mv').classList.toggle('on',on);$('mv').setAttribute('aria-pressed',String(on));};
window.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();toggleSpin();},true);
$('collection').onclick=()=>$('drawer').hidden=!$('drawer').hidden;$('close').onclick=()=>$('drawer').hidden=true;
const req=indexedDB.open('rondo-cd-atelier',1);req.onupgradeneeded=()=>req.result.createObjectStore('covers',{keyPath:'id'});req.onsuccess=()=>{db=req.result;const r=db.transaction('covers').objectStore('covers').getAll();r.onsuccess=()=>{albums=[...defaults,...r.result];restoreOrder();renderAlbums();};};req.onerror=()=>$('status').textContent='저장 공간에 접근할 수 없어 이번 화면에서만 사용할 수 있습니다.';
fetch('./covers.json').then(r=>r.json()).then(items=>{defaults=items;albums=[...items,...albums.filter(a=>!a.builtin)];restoreOrder();renderAlbums();loadDefault();const warm=async()=>{for(const a of items){try{await sceneStage.preloadArt(a.data);}catch{}await new Promise(r=>setTimeout(r,120));}};setTimeout(warm,1000);}).catch(()=>$('status').textContent='기본 커버를 불러오지 못했습니다. 새로고침하십시오.');
function renderAlbums(){
 const rail=$('discRail');rail.replaceChildren();const el=$('albums');el.replaceChildren();
 for(const [i,a] of albums.entries()){
  const title=displayName(a);
  const choice=document.createElement('button');choice.className='disc-choice'+(a.id===selected?' on':'');choice.title=title;choice.setAttribute('aria-label',title);choice.setAttribute('aria-pressed',String(a.id===selected));
  const thumb=document.createElement('img');thumb.src=a.data;thumb.alt='';choice.append(thumb);choice.onclick=()=>apply(a);rail.append(choice);
  const card=document.createElement('div');card.className='album-card';const b=document.createElement('button');b.className='album'+(a.id===selected?' on':'');b.setAttribute('aria-pressed',String(a.id===selected));
  const im=document.createElement('img');im.src=a.data;im.alt='';const name=document.createElement('span');name.textContent=title;b.title=title;b.append(im,name);b.onclick=()=>apply(a);card.append(b);
  const moves=document.createElement('div');moves.className='album-moves';
  for(const [offset,label] of [[-1,'← 앞으로'],[1,'뒤로 →']]){const button=document.createElement('button');button.textContent=label;button.dataset.moveId=a.id;button.dataset.direction=offset;button.setAttribute('aria-label',title+' '+(offset<0?'앞으로 이동':'뒤로 이동'));button.disabled=offset<0?i===0:i===albums.length-1;button.onclick=()=>moveAlbum(a.id,offset);moves.append(button);}
  card.append(moves);el.append(card);
 }
 const current=albums.find(a=>a.id===selected);if(current)setAlbumLabel(displayName(current));
}
async function apply(a){selected=a.id;selectMusic(a.id,spin&&!paused);setAlbumLabel(displayName(a));renderAlbums();try{await sceneStage.setArt(a.data,$('target').value,true,a.id==='rondo-4'?1.09:1);if(selected===a.id){setAlbumLabel(displayName(a));renderAlbums();}}catch(e){$('status').textContent='커버를 적용하지 못했습니다.';}}
$('target').onchange=()=>{const a=albums.find(a=>a.id===selected);if(a)apply(a);};
$('files').onchange=async e=>{for(const file of e.target.files){if(!file.type.startsWith('image/'))continue;try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),s=Math.min(im.width,im.height);ctx.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,1024,1024);const a={id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),data:c.toDataURL('image/jpeg',.9)};albums.push(a);if(db){await new Promise((resolve,reject)=>{const tx=db.transaction('covers','readwrite');tx.objectStore('covers').put(a);tx.oncomplete=resolve;tx.onerror=reject;});}$('status').textContent=db?'커버를 저장했습니다.':'커버를 추가했습니다. 현재 화면에서만 유지됩니다.';apply(a);}catch(err){$('status').textContent='이미지를 불러오거나 저장하지 못했습니다. JPG 또는 PNG로 다시 시도하십시오.';}}renderAlbums();e.target.value='';};
function clear(){selectMusic(null,false);sceneStage.clearArt();selected=null;$('label').textContent='RONDO — SILVER';renderAlbums();}$('clear').onclick=clear;$('remove').onclick=()=>{if(!selected)return;if(albums.find(a=>a.id===selected)?.builtin){$('status').textContent='기본 커버는 유지됩니다. 직접 추가한 커버만 삭제할 수 있습니다.';return;}const id=selected;if(db){const tx=db.transaction('covers','readwrite');tx.objectStore('covers').delete(id);tx.onerror=()=>$('status').textContent='저장된 커버를 삭제하지 못했습니다.';}albums=albums.filter(a=>a.id!==id);clear();};


const albumRail=$('discRail');
function updateAlbumScroll(){const end=albumRail.scrollWidth-albumRail.clientWidth;$('albumPrev').disabled=albumRail.scrollLeft<=1;$('albumNext').disabled=albumRail.scrollLeft>=end-1;}
$('albumPrev').onclick=()=>albumRail.scrollBy({left:-Math.max(80,albumRail.clientWidth*.8),behavior:'smooth'});
$('albumNext').onclick=()=>albumRail.scrollBy({left:Math.max(80,albumRail.clientWidth*.8),behavior:'smooth'});
albumRail.addEventListener('scroll',updateAlbumScroll,{passive:true});
new ResizeObserver(updateAlbumScroll).observe(albumRail);
new MutationObserver(updateAlbumScroll).observe(albumRail,{childList:true});
updateAlbumScroll();




function setAlbumLabel(name){const label=$('label');label.replaceChildren();const split=name.indexOf(' · ');if(split>=0){const number=document.createElement('span');number.textContent=name.slice(0,split)+' · ';label.append(number);}const title=document.createElement('strong');title.textContent=split>=0?name.slice(split+3):name;label.append(title);}
