import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {C1,CROP,armAngle,armFrame,fitCabinet,frameIndex,projection} from '../living/math.js';

test('engineering projection keeps the C1 film anchor at both review sizes and letterboxes',()=>{
  for(const [w,h] of [[1280,720],[1920,1080],[1440,900]]){
    const f=fitCabinet(w,h),r=C1.r*.4,q=[[C1.cx-r,C1.cy+r],[C1.cx+r,C1.cy+r],[C1.cx+r,C1.cy-r],[C1.cx-r,C1.cy-r]],map=projection(q),p=map(.5,.5);
    assert.ok(Math.abs((p[0]/1.2+CROP.x)*f.scale+f.x-(C1.cx*f.scale+f.x))<1e-8);
    assert.ok(Math.abs((p[1]/1.2+CROP.y)*f.scale+f.y-(C1.cy*f.scale+f.y))<1e-8);
    assert.ok(1920*f.scale<=w&&1080*f.scale<=h);
  }
  assert.equal(projection([[1,1],[1,1],[1,1],[1,1]]),null);
});
test('label frames and current-groove arm lift remain bounded at either speed',()=>{
  for(const [frames,seconds] of [[90,1.5],[60,1]])for(const speed of [1,1.8]){
    assert.equal(frameIndex(-1,frames),0);assert.equal(frameIndex(seconds,frames),frames-1);
    for(let t=0;t<=seconds/speed;t+=.005)assert.ok(frameIndex(t*speed,frames)<frames);
  }
  for(const p of [0,.25,.75,1]){
    assert.equal(armAngle(p,0),armAngle(p));assert.equal(armAngle(p,160),-22);
    let previous=armAngle(p,0);for(let ms=1;ms<=160;ms++){const a=armAngle(p,ms);assert.ok(a<=previous+1e-9);assert.ok(armFrame(a)>=0&&armFrame(a)<=35);previous=a;}
  }
});
test('integration retains current production audio, playback clocks, cinematic and worker',async()=>{
  for(const name of ['app.js','audio.js','player.js','jukebox-sfx.js','jukebox-sprite.js','vinyl.js','sound.js','awakening-film.js','sw.js','films/manifest.json']){
    const baseline=execFileSync('git',['show',`bb9e0df:${name}`]);
    assert.deepEqual(await readFile(new URL('../'+name,import.meta.url)),baseline,`${name} changed`);
  }
});

test('rendered pickup, seat and landing stay within one authored sample of production sound cues',async()=>{
  const {MOVES}=await import('../jukebox-sfx.js');
  for(const [kind,total,transitions] of [
    ['load',1500,[['servo','gripper'],['drop','platter']]],
    ['eject',1000,[['servo','gripper'],['seat','magazine']]],
  ]){
    const poses=JSON.parse(await readFile(new URL(`../living/assets/${kind}-tracking.json`,import.meta.url),'utf8'));
    for(const [cue,owner] of transitions){const at=MOVES[kind].find(x=>x[1]===cue)[0]*total,pose=poses.find(p=>p.owner===owner);assert.ok(Math.abs(at-pose.timeMs)<=total/(poses.length-1),`${kind} ${cue}: ${at} vs ${pose.timeMs}`);}
  }
});
// WebP canvas size from its header (VP8X, VP8L or VP8), for the decoded-memory budget.
function webpSize(b){const f=b.toString('ascii',12,16);if(f==='VP8X')return[1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];if(f==='VP8L'){const n=b.readUInt32LE(21);return[(n&0x3fff)+1,((n>>14)&0x3fff)+1];}return[b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];}
test('offline manifest lists exactly the shipped runtime files, with bounded motion sheets',async()=>{
  const {OFFLINE_FILES}=await import('../living/offline.js');
  const {readdir}=await import('node:fs/promises');
  for(const file of OFFLINE_FILES)assert.ok((await readFile(new URL('../living/'+file,import.meta.url))).length,file);
  for(const name of ['live.js','live.css','math.js','offline.js','drive.js','film-check.js','../living-jukebox.html'])assert.ok(OFFLINE_FILES.includes(name));
  // Nothing development-only ships: every file under living/ is a listed runtime file.
  const shipped=[...(await readdir(new URL('../living/',import.meta.url))).filter(n=>n!=='assets'),...(await readdir(new URL('../living/assets/',import.meta.url))).map(n=>`assets/${n}`)];
  assert.deepEqual(shipped.filter(n=>!OFFLINE_FILES.includes(n)),[]);
  let decoded=0;for(const [kind,rows] of [['load',9],['eject',6]])for(let n=0;n<rows;n++){const [w,h]=webpSize(await readFile(new URL(`../living/assets/${kind}-${n}.webp`,import.meta.url)));assert.equal(h,360);decoded+=w*h*4;}
  assert.ok(decoded<140*1024*1024,`${decoded}`);
});
