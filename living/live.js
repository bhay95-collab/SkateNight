import {CROP,C1,clamp,frameIndex,armAngle,armFrame,fitCabinet,projection} from './math.js';
import {OFFLINE_FILES} from './offline.js';
import {createDrivePainter,createDriveClock} from './drive.js';
import {startFilmCheck} from './film-check.js';
// ?diagnostics: label which film plays (approved or live cut) and hold a coin while the film verifies. Not shown in the show.
const filmCheck=new URLSearchParams(location.search).has('diagnostics')?startFilmCheck():null;
import {isCalm,onCalmChange} from '../fx.js';
const $=id=>document.getElementById(id),root=$('mech'),params=new URLSearchParams(location.search),assets=new URL('assets/',import.meta.url);
const started=performance.now(),image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const fit=()=>{const f=fitCabinet(innerWidth,innerHeight),s=$('jukebox').style;s.setProperty('--cab-scale',f.scale);s.setProperty('--cab-x',`${f.x}px`);s.setProperty('--cab-y',`${f.y}px`);};fit();addEventListener('resize',fit);
let drive=null;const driveClock=createDriveClock();
let generation=0,move=null,progress=0,volume=null,trackId=null,phase='empty',raf=0,spinBase=0,spinAnimation=null,sourceAngle=NaN,labelOffset=0;
const sheets={},masks={},tracks={},covers=new Map(),events=[],stats={frames:0,maxQuantizationMs:0,maxPaintDelayMs:0,failures:[],events};
const canvas=document.createElement('canvas');canvas.className='engineering-label';canvas.width=768;canvas.height=432;canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');
const source=document.createElement('canvas');source.width=source.height=512;const sx=source.getContext('2d');
const mask=document.createElement('canvas');mask.width=768;mask.height=432;const mx=mask.getContext('2d');
const plate=document.createElement('canvas');plate.className='engineering-video';plate.width=640;plate.height=360;plate.setAttribute('aria-hidden','true');const px=plate.getContext('2d');
const arm=document.createElement('canvas');arm.className='engineering-arm';arm.width=160;arm.height=285;const ax=arm.getContext('2d');
const lamp=document.createElement('i');lamp.className='engineering-worklamp';
root.append(plate,canvas,arm,lamp);
function rawRecordAngle(){spinAnimation??=$('record').getAnimations().find(a=>a.animationName==='record-spin');return spinAnimation?Number(spinAnimation.currentTime||0)/1333.333*360:0;}
function recordAngle(){return rawRecordAngle()+labelOffset;}
function artwork(angle){if(sourceAngle===angle)return;sourceAngle=angle;sx.clearRect(0,0,512,512);if(!volume||!covers.has(volume.id))return;sx.save();sx.translate(256,256);sx.rotate(angle*Math.PI/180);sx.beginPath();sx.arc(0,0,256,0,Math.PI*2);sx.clip();sx.drawImage(covers.get(volume.id),-256,-256,512,512);sx.restore();sx.globalCompositeOperation='destination-out';sx.beginPath();sx.arc(256,256,256*5.7/(C1.r*.4),0,Math.PI*2);sx.fill();sx.globalCompositeOperation='source-over';}
function triangle(s,d){const[a,b,c]=s,[p,q,r]=d,det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]),A=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det,B=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det,C=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det,D=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
 ctx.save();const cx=(p[0]+q[0]+r[0])/3,cy=(p[1]+q[1]+r[1])/3,edge=point=>{const x=point[0]-cx,y=point[1]-cy,k=1+.35/Math.max(.01,Math.hypot(x,y));return[cx+x*k,cy+y*k];};ctx.beginPath();ctx.moveTo(...edge(p));ctx.lineTo(...edge(q));ctx.lineTo(...edge(r));ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p[0]-A*a[0]-C*a[1],p[1]-B*a[0]-D*a[1]);ctx.drawImage(source,0,0);ctx.restore();}
function drawLabel(p,index=-1){ctx.clearRect(0,0,768,432);if(!volume)return;
 if(index<0){artwork(recordAngle());const r=C1.r*.4*1.2;ctx.drawImage(source,(C1.cx-CROP.x)*1.2-r,(C1.cy-CROP.y)*1.2-r,r*2,r*2);return;}
 artwork(spinBase);const map=projection(p.quad);if(!map)return;
 const n=10;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=[x/n,y/n],b=[(x+1)/n,y/n],c=[(x+1)/n,(y+1)/n],d=[x/n,(y+1)/n];for(const t of [[a,b,c],[a,c,d]])triangle(t.map(([u,v])=>[u*512,v*512]),t.map(([u,v])=>map(u,v)));}
 const [x,y,w,h]=p.maskBox;mx.clearRect(0,0,768,432);if(w&&h)mx.drawImage(masks[move.kind],index%10*128,Math.floor(index/10)*128,w,h,x,y,w,h);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';}
let armAtlas,armMeta,lastArm=NaN;
function drawArm(angle){const f=armFrame(angle);if(lastArm===f)return;lastArm=f;ax.clearRect(0,0,160,285);const[w,h]=armMeta.cell,a=Math.floor(f),b=Math.min(35,a+1),u=f-a;ax.drawImage(armAtlas,a%6*w,Math.floor(a/6)*h,w,h,0,0,160,285);if(u){ax.globalAlpha=u;ax.drawImage(armAtlas,b%6*w,Math.floor(b/6)*h,w,h,0,0,160,285);ax.globalAlpha=1;}}
function paintDrive(){if(drive&&phase==='playing'&&!move)drive.paint('play',0,driveClock.play(recordAngle()));}
function stop(){cancelAnimationFrame(raf);raf=0;}
function paintPlate(kind,index){px.drawImage(sheets[kind][Math.floor(index/10)],index%10*640,0,640,360,0,0,640,360);}
function idle(){stop();move=null;delete root.dataset.moving;plate.style.display=phase==='playing'?'none':'block';arm.style.display=phase==='playing'?'block':'none';if(phase!=='playing'){ctx.clearRect(0,0,768,432);paintPlate('eject',59);drive?.paint('eject',59,driveClock.drive);return;}
 drawArm(armAngle(progress));drawLabel();paintDrive();let previous=0;const tick=now=>{if(document.hidden)return;paintDrive();if(now-previous>=1000/30){previous=now;drawLabel();}if(!isCalm())raf=requestAnimationFrame(tick);};if(!document.hidden&&!isCalm()&&!root.classList.contains('is-paused'))raf=requestAnimationFrame(tick);}
function paintMove(time){if(!move)return;const i=frameIndex(time,tracks[move.kind].length),p=tracks[move.kind][i];paintPlate(move.kind,i);drawLabel(p,i);drive?.paint(move.kind,i,driveClock.moveTo(p.spinDeg));stats.driveFrame=[move.kind,i];stats.frames++;stats.maxQuantizationMs=Math.max(stats.maxQuantizationMs,Math.abs(i/60-Math.min(time,(tracks[move.kind].length-1)/60))*1000);if(move.kind==='eject'&&p.timeMs<=160){arm.style.display='block';drawArm(armAngle(progress,p.timeMs));}else arm.style.display='none';}
function fail(error){stats.failures.push(String(error));console.warn('[engineering layer]',error);stop();for(const e of [plate,canvas,arm,lamp,drive?.canvas])e?.remove();drive=null;document.querySelector('.cover-tabs')?.remove();root.dataset.visualLayer='';document.documentElement.classList.remove('engineering');window.__living.ready=false;window.__living.error=String(error);dispatchEvent(new Event('living:offline'));}
function animateMove(){const token=move?.token;if(!move||document.hidden)return;const tick=now=>{if(!move||move.token!==token||document.hidden)return;stats.maxPaintDelayMs=Math.max(stats.maxPaintDelayMs,Math.max(0,performance.now()-now));const paintStart=performance.now();paintMove(Math.max(0,now-move.at)*move.speed/1000);stats.maxFramePaintMs=Math.max(stats.maxFramePaintMs||0,performance.now()-paintStart);if(now-move.at<move.ms)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);}
function run(detail){stop();if(driveClock.engaged)driveClock.play(recordAngle());driveClock.startMove();const token=++generation;spinBase=detail.action==='eject'?recordAngle():0;sourceAngle=NaN;move={kind:detail.action,at:detail.at,speed:detail.speed,ms:detail.ms,token};root.dataset.moving=move.kind;phase=move.kind==='load'?'playing':'empty';
 if(detail.volume){volume=detail.volume;sourceAngle=NaN;}if(detail.action==='load'){progress=0;trackId=detail.trackId;spinAnimation=null;labelOffset=0;}
 plate.style.display='block';paintMove(0);
 if(detail.calm||matchMedia('(prefers-reduced-motion: reduce)').matches){phase=detail.action==='load'?'playing':'empty';idle();return;}
 animateMove();
}
try{
 if(getComputedStyle(document.documentElement).getPropertyValue('--engineering-style').trim()!=='ready')throw Error('Prototype stylesheet unavailable; original controls retained');
 const catalog=await json(new URL('catalog.json',assets));
 [armAtlas,armMeta]=await Promise.all([image(new URL('assets/arm.webp',import.meta.url)),json(new URL('assets/arm.json',import.meta.url))]);
 await Promise.all([image(new URL('hero.webp',assets)),...catalog.volumes.map(async v=>covers.set(v.id,await image(new URL('../'+v.cover,import.meta.url))))]);
 // shortcut: All selections share the approved three-slot stroke; export variable index travel before simulating arbitrary rack positions.
 await Promise.all(['load','eject'].map(async kind=>{const data=await Promise.all([json(new URL(`${kind}-tracking.json`,assets)),image(new URL(`${kind}-mask.png`,assets)),Promise.all(Array.from({length:kind==='load'?9:6},(_,row)=>image(new URL(`assets/${kind}-${row}.webp`,import.meta.url))))]);tracks[kind]=data[0];masks[kind]=data[1];sheets[kind]=data[2];}));
 // ?drive=0 keeps the approved static plate, for comparison.
 drive=params.get('drive')==='0'?null:await createDrivePainter(new URL('assets/',import.meta.url)).catch(error=>{stats.failures.push(`drive: ${error}`);console.warn('[engineering drive]',error);return null;});
 if(drive)root.insertBefore(drive.canvas,arm);
 // Force the bounded sheets through the canvas before the coin can expose a cold GPU upload.
 for(const kind of ['load','eject']){paintPlate(kind,0);}
 const tabs=document.createElement('nav');tabs.className='cover-tabs';tabs.setAttribute('aria-label','Browse albums');for(const v of catalog.volumes){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Browse ${v.title}`);const i=document.createElement('img');i.src=new URL('../'+v.cover,import.meta.url);i.alt='';b.append(i);b.onclick=()=>{const api=window.__skateNight;if(!api)return;const target=catalog.volumes.findIndex(x=>x.id===v.id),current=catalog.volumes.findIndex(x=>x.letter===$('rack-letter').textContent),steps=(target-current+catalog.volumes.length)%catalog.volumes.length;for(let n=0;n<steps;n++)$('rack-next').click();};tabs.append(b);}$('jukebox').append(tabs);
 root.addEventListener('jukebox:mechanism',e=>{const d=e.detail;if(d.action!=='progress'&&d.action!=='paused'){events.push({...d,volume:d.volume?.id});if(events.length>100)events.shift();}try{
  if(d.action==='load'||d.action==='eject')run(d);
  else if(d.action==='playing'){++generation;phase='playing';progress=0;volume=d.volume;trackId=d.trackId;sourceAngle=NaN;spinAnimation=null;labelOffset=0;driveClock.engage(recordAngle());idle();}
  else if(d.action==='reset'){++generation;phase='empty';progress=0;trackId=null;driveClock.release();idle();}
  else if(d.action==='finish'){phase=d.move==='load'?'playing':'empty';spinAnimation=null;driveClock.moveTo(tracks[d.move].at(-1).spinDeg);if(d.move==='load'){labelOffset=tracks.load.at(-1).spinDeg-rawRecordAngle();stats.lastSeating={renderedSpin:tracks.load.at(-1).spinDeg,labelOffset};driveClock.engage(recordAngle());}idle();if(d.move==='load')stats.lastSeating.visibleAngle=sourceAngle;}
  else if(d.action==='progress'){if(!trackId||window.__skateNight?.state().nowId===trackId){progress=clamp(d.ratio);if(!move&&phase==='playing')drawArm(armAngle(progress));}}
  else if(d.action==='paused'){if(!move&&phase==='playing')idle();}
 }catch(error){fail(error);}});
 if(params.get('skin')==='current'){for(const e of [plate,canvas,arm,lamp,tabs,drive?.canvas])e?.remove();drive=null;}else{root.dataset.visualLayer='engineering';document.documentElement.classList.add('engineering');}
 window.__living={filmCheck,ready:true,decodeMs:performance.now()-started,stats,get state(){return {phase,move:move?.kind||null,progress,volume:volume?.id,raf:raf?1:0,labelAngle:sourceAngle,labelOffset,drive:driveClock.engaged&&!move?driveClock.play(recordAngle()):driveClock.drive,driveEngaged:driveClock.engaged,driveReady:!!drive,frameSheets:Object.keys(sheets).length,decodedMotionMiB:131.8359375};}};
 for(const id of ['awakening-film','production-preview-video'])$(id)?.addEventListener('ended',()=>requestAnimationFrame(()=>{if(phase==='playing'&&!move){drawLabel();stats.filmLabel={cssAngle:rawRecordAngle(),visibleAngle:sourceAngle};}}));
 idle();document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(move){if(performance.now()-move.at>=move.ms)idle();else animateMove();}else idle();});onCalmChange(()=>{if(!move)idle();});
 // The production worker saves every file it serves; fetch the visuals once so they are there offline.
 const offline=document.createElement('output');offline.className='prototype-status';offline.setAttribute('role','status');offline.textContent='Saving jukebox visuals…';document.querySelector('.utility-panel').append(offline);
 if('serviceWorker'in navigator)navigator.serviceWorker.ready.then(async()=>{
  if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));
  const urls=OFFLINE_FILES.map(x=>new URL(x,import.meta.url));
  await Promise.all(urls.map(async x=>{try{const r=await fetch(x);if(!r.ok)throw Error(`HTTP ${r.status}`);await r.arrayBuffer();}catch(e){throw Error(`${x.pathname}: ${e.message}`);}}));
  for(let attempt=0;attempt<50;attempt++){
   if((await Promise.all(urls.map(x=>caches.match(x)))).every(Boolean)){window.__living.offlineReady=true;offline.textContent='Jukebox visuals saved offline.';dispatchEvent(new Event('living:offline'));return;}
   await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Visual cache did not finish writing');
 }).catch(e=>{window.__living.offlineError=String(e);dispatchEvent(new Event('living:offline'));offline.textContent='Jukebox visuals could not be saved. Reload online before the show.';});
 if(params.has('inspect')){const wait=setInterval(()=>{if(!window.__skateNight)return;clearInterval(wait);document.body.classList.remove('on-attract');$('attract').classList.add('is-revealed');$('boot').hidden=true;},25);}
}catch(error){window.__living={filmCheck,ready:false,error:String(error)};fail(error);}
addEventListener('pagehide',stop);
