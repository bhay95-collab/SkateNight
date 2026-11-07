import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DRIVE_TEETH,gearAngle,gearSign,spriteFrame,createDriveClock} from '../living/drive.js';
import {frameIndex} from '../living/math.js';
import {filmVerdict} from '../living/film-check.js';

const integration=new URL('../living/',import.meta.url);
const tracking=async kind=>JSON.parse(await readFile(new URL(`../living/assets/${kind}-tracking.json`,import.meta.url),'utf8'));
const RECORD_DEG_PER_MS=360/1333.333;            // 45 RPM, the record's CSS spin

test('meshing platter gears turn opposite ways at tooth-count speeds, 26T 1:1 with the record',()=>{
  assert.deepEqual(DRIVE_TEETH,[26,32,28,40]);
  for(let n=1;n<DRIVE_TEETH.length;n++)assert.equal(gearSign(DRIVE_TEETH[n]),-gearSign(DRIVE_TEETH[n-1]),'neighbours counter-rotate');
  for(const drive of [0,1,91.0557374652127,-37,7200.5]){
    assert.ok(Math.abs(gearAngle(drive,26)-drive)<1e-9);
    // Equal tooth-passing rate along the train: |angle| * teeth is shared, so pitch-line speeds match.
    for(const t of DRIVE_TEETH)assert.ok(Math.abs(Math.abs(gearAngle(drive,t))*t-Math.abs(drive)*26)<1e-9);
  }
});

test('the browser relationship is the approved pose solver formula, not a new animation',async()=>{
  // mechanical-study/build.py apply_pose (development branch): angle = spin*26/teeth*(-1)**(3-j), gear_bases j = 40, 28, 32, 26.
  for(const [j,t] of [40,28,32,26].entries())assert.equal(gearSign(t),(-1)**(3-j));
  // The seated pose ends on the authored spin the drive re-engages from.
  const load=await tracking('load');assert.ok(load.at(-1).spinDeg>100&&load.every(p=>Number.isFinite(p.spinDeg)));
});

test('the film diagnostic label is off in the show and only starts with ?diagnostics',async()=>{
  const live=await readFile(new URL('live.js',integration),'utf8');
  assert.match(live,/has\('diagnostics'\)\?startFilmCheck\(\):null/);
  assert.equal((live.match(/startFilmCheck\(\)/g)||[]).length,1);
});

test('sprite frame plus residual reproduces any angle within half a step',()=>{
  const frames=60,step=360/frames;
  for(let a=-1000;a<=1000;a+=.37){
    const {k,residual}=spriteFrame(a,frames);
    assert.ok(k>=0&&k<frames&&Number.isInteger(k));assert.ok(Math.abs(residual)<=step/2+1e-9);
    const back=k*step+residual,wrapped=((a%360)+360)%360;assert.ok(Math.abs(((back-wrapped+540)%360)-180)<1e-9);
  }
});

test('drive phase is continuous through film handoff, pause, eject and load at both speeds',async()=>{
  const load=await tracking('load'),eject=await tracking('eject');
  assert.ok(load.at(-1).spinDeg>100);assert.equal(eject[0].spinDeg,0);
  for(const speed of [1,1.8]){
    const clock=createDriveClock(),values=[];let record=91.0557374652127,labelOffset=0;
    const recordAngle=()=>record+labelOffset,step=(ms,playing=true)=>{if(playing)record+=ms*RECORD_DEG_PER_MS;values.push(clock.play(recordAngle()));};
    clock.engage(recordAngle());                              // the film lands on the spinning opener: no load sequence
    assert.equal(clock.drive,0);
    for(let i=0;i<120;i++)step(16.7);
    const beforePause=clock.drive;for(let i=0;i<30;i++)step(16.7,false);assert.equal(clock.drive,beforePause,'paused record, paused drive');
    for(let i=0;i<30;i++)step(16.7);
    for(let change=0;change<3;change++){
      clock.play(recordAngle());clock.startMove();
      for(const [kind,poses,total] of [['eject',eject,1000],['load',load,1500]]){
        for(let t=0;t<=total/speed+1e-9;t+=1000/60){const p=poses[frameIndex(t*speed/1000,poses.length)];values.push(clock.moveTo(p.spinDeg));}
        values.push(clock.moveTo(poses.at(-1).spinDeg));
        if(kind==='eject')clock.startMove();
      }
      labelOffset=load.at(-1).spinDeg-record;                  // live.js: the label keeps the seated phase
      clock.engage(recordAngle());
      for(let i=0;i<60;i++)step(16.7);
    }
    // Largest step: one 60 Hz frame of the record, or one authored pose sample at 1.8x.
    const jumps=values.slice(1).map((v,i)=>Math.abs(v-values[i]));
    assert.ok(Math.max(...jumps)<=Math.max(16.7*RECORD_DEG_PER_MS,10*speed)+1e-6,`${speed}x max step ${Math.max(...jumps)}`);
    assert.ok(values.every(Number.isFinite));
  }
});

test('reset releases the drive and the next playing record engages without a jump',()=>{
  const clock=createDriveClock();clock.engage(10);clock.play(55);assert.equal(clock.drive,45);
  clock.release();assert.equal(clock.play(500),45);assert.equal(clock.engaged,false);
  clock.engage(500);assert.equal(clock.play(510),55);
});

test('drive assets are complete, offline, bounded and cover every baked gear pixel',async()=>{
  const meta=JSON.parse(await readFile(new URL('assets/drive.json',integration),'utf8'));
  assert.deepEqual(meta.gears.map(g=>g.teeth),[26,32,28,40]);
  for(const g of meta.gears){assert.equal(g.sign,gearSign(g.teeth));assert.equal(g.frames,60);assert.ok(g.pivot[0]>0&&g.pivot[1]>0);}
  assert.equal(meta.moves.load.frames,90);assert.equal(meta.moves.eject.frames,60);
  assert.equal(meta.moves.load.boxes.length,90);assert.equal(meta.moves.eject.boxes.length,60);
  assert.equal(meta.footprint.uncovered,0,'a baked gear pixel would show under the animated gear');
  assert.ok(meta.decodedBytes<64*1024*1024,`decoded ${meta.decodedBytes}`);
  const {OFFLINE_FILES}=await import('../living/offline.js');
  const names=[meta.play.background,meta.play.overlay,...meta.gears.map(g=>g.atlas),...Object.values(meta.moves).flatMap(m=>[m.background,m.overlay])].filter(Boolean);
  for(const name of [...names,'drive.json'])assert.ok(OFFLINE_FILES.includes(`assets/${name}`),`${name} not cached`);
  for(const name of ['drive.js','film-check.js'])assert.ok(OFFLINE_FILES.includes(name));
  for(const name of names)assert.ok((await readFile(new URL(`assets/${name}`,integration))).length>0);
});

test('the review names the film that plays and never passes off the live cut',()=>{
  const sha='402b2ca892d26dd56a9762429e2fbc2a4461d020065fc57ea299adbd12983cc9';
  const text='WEBSITE FILM DOWNLOADED - VERIFIED - READY OFFLINE — V2 · 35.0 S · 1920x1080 · 30 FPS · SHA 402B2CA8';
  assert.equal(filmVerdict({state:'ready',text,approvedSha:sha,playable:true}).tone,'ok');
  assert.match(filmVerdict({state:'ready',text,approvedSha:sha,playable:false}).label,/LIVE CUT/);
  assert.match(filmVerdict({state:'ready',text,approvedSha:sha,playable:false}).detail,/Chrome/);
  assert.equal(filmVerdict({state:'checking',text:'',approvedSha:sha,playable:true}).tone,'wait');
  assert.equal(filmVerdict({state:'ready',text:text.replace('402B2CA8','DEADBEEF'),approvedSha:sha,playable:true}).tone,'bad');
  assert.match(filmVerdict({state:'bad',text:'NO VERIFIED FILM - LIVE CUT READY',approvedSha:sha,playable:true}).label,/LIVE CUT/);
});
