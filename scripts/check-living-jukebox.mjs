#!/usr/bin/env node
/* Release acceptance for the default photorealistic jukebox (index.html) and the classic fallback, in real Google Chrome.
     node scripts/check-living-jukebox.mjs [--previous ../SkateNight-release] [--base URL] [--out build/living-jukebox/acceptance]
   Serves this worktree itself (or tests --base, e.g. the live site, without the upgrade step). --previous is a checkout of
   the build being replaced: it is installed first (songs and film saved), then the same address switches to this build.
   Upgrade, installability, film at 1280x720 and 1920x1080, drive phase lock, pause, normal and 1.8x changes with different labels, changer
   sound alignment, queue/transport/volume, ambience and vinyl, offline reload, missing/corrupt visual assets, and
   main-thread cost with and without the drive. Writes acceptance.json and screenshots; exits 1 on failure. */
import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),opt=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
// A static server whose root can be switched: the previous build, then this one, on the same origin (same caches, same OPFS).
const HERE=resolve(new URL('..',import.meta.url).pathname);let root=resolve(opt('--previous',HERE));
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac','.mp4':'video/mp4','.woff2':'font/woff2'};
let BASE=opt('--base',null),server=null;
if(!BASE){server=createServer(async(req,res)=>{const u=new URL(req.url,'http://x'),path=resolve(root,'.'+decodeURIComponent(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const data=await readFile(path);res.writeHead(200,{'content-type':MIME[extname(path)]||'application/octet-stream','content-length':data.length,'cache-control':'no-store'}).end(data);}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));BASE=`http://127.0.0.1:${server.address().port}`;}
const OUT=resolve(opt('--out','build/living-jukebox/acceptance'));await mkdir(OUT,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('../films/manifest.json',import.meta.url)));
const POSES=Object.fromEntries(await Promise.all(['load','eject'].map(async k=>[k,JSON.parse(await readFile(new URL(`../living/assets/${k}-tracking.json`,import.meta.url)))])));
const report={base:BASE,started:new Date().toISOString(),film:{},checks:{}};
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});report.browser=b.version();

// Every buffer source (changer sprite, needle, beds, vinyl surface) and the player's decks.
const probe=()=>{
  const Native=Audio;window.__decks=[];window.Audio=function(...a){const x=new Native(...a);__decks.push(x);return x;};window.Audio.prototype=Native.prototype;
  window.__src=[];window.__live=0;window.__maxLive=0;const {start}=AudioBufferSourceNode.prototype;
  const kind=b=>!b?'none':Math.abs(b.duration-9)<.01?'surface':Math.abs(b.duration-.32)<.01?'needle':(Math.abs(b.duration-8)<.01||Math.abs(b.duration-7)<.01)?'bed':b.duration>20&&b.duration<40?'sprite':'other';
  AudioBufferSourceNode.prototype.start=function(...a){__live++;__maxLive=Math.max(__maxLive,__live);this.addEventListener('ended',()=>__live--,{once:true});__src.push({kind:kind(this.buffer),t:performance.now()});return start.apply(this,a);};
};
// Per-frame drive samples with the record's own CSS clock and the plate frame on screen.
const sampler=()=>{const rec=document.getElementById('record');window.__trace=[];const tick=now=>{const s=__living.state,a=rec.getAnimations().find(x=>x.animationName==='record-spin');
  __trace.push({t:now,drive:s.drive,engaged:s.driveEngaged,move:s.move,frame:__living.stats.driveFrame,record:a?Number(a.currentTime||0)/1333.333*360+s.labelOffset:null,running:a?.playState==='running',paused:document.getElementById('mech').classList.contains('is-paused')});requestAnimationFrame(tick);};requestAnimationFrame(tick);};
const take=p=>p.evaluate(()=>{const t=__trace;window.__trace=[];return t;});
function analyse(trace){
  let poseErr=0,poseChecks=0,spread=0,run=[];const close=()=>{if(run.length)spread=Math.max(spread,Math.max(...run)-Math.min(...run));run=[];};
  for(let n=1;n<trace.length;n++){const [x,y]=[trace[n-1],trace[n]];if(x.move&&y.move===x.move&&x.frame?.[0]===y.move&&y.frame?.[0]===y.move){poseErr=Math.max(poseErr,Math.abs((y.drive-x.drive)-(POSES[y.move][y.frame[1]].spinDeg-POSES[y.move][x.frame[1]].spinDeg)));poseChecks++;}}
  for(const s of trace){if(s.engaged&&!s.move&&s.record!==null&&s.running&&!s.paused)run.push(s.drive-s.record);else close();}close();
  return {samples:trace.length,lockSpreadDeg:spread,poseChecks,poseErrDeg:poseErr,driveTravelDeg:Math.max(...trace.map(s=>s.drive))-Math.min(...trace.map(s=>s.drive)),moves:[...new Set(trace.map(s=>s.move).filter(Boolean))]};
}
async function open(c,query='',page=''){
  const p=await c.newPage();p.errors=[];p.on('pageerror',e=>p.errors.push(String(e)));
  await p.goto(`${BASE}/${page}${query}`);
  await p.waitForFunction(()=>window.__skateNight&&document.getElementById('film-status').dataset.state!=='checking',null,{timeout:90000});
  // The living layer reports ready or failed; with its module missing it never appears and production controls remain.
  await p.waitForFunction(()=>window.__living&&'ready' in window.__living,null,{timeout:20000}).catch(()=>{});
  return p;
}
async function film(p,label){
  const status=await p.evaluate(()=>({state:document.getElementById('film-status').dataset.state,text:document.getElementById('film-status').textContent}));
  assert.equal(status.state,'ready',`${label}: film not ready (${status.text})`);assert.match(status.text,new RegExp(`SHA ${manifest.sha256.slice(0,8).toUpperCase()}`),`${label}: not the approved film`);
  await p.evaluate(()=>{const v=document.getElementById('awakening-film');window.__filmFrames=[];const f=(now,m)=>{__filmFrames.push(m.mediaTime);v.requestVideoFrameCallback(f);};v.requestVideoFrameCallback(f);
    window.__music=[];const tick=()=>{__music.push(__decks.filter(a=>!a.paused&&!a.muted&&a.currentTime>0).length);if(!window.__overlapStats?.revealMs||__music.length<10)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await p.click('#attract');
  await p.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});
  // Around the reveal: no black or uncovered frames (a black 1080p PNG is a few KB), the record and drive are live.
  const shots=[];let last=0;for(const at of [0,150,400]){await p.waitForTimeout(at-last);last=at;const png=await p.screenshot({path:`${OUT}/${label}-reveal-${at}.png`});shots.push({at,bytes:png.length});}
  const r=await p.evaluate(()=>{const v=document.getElementById('awakening-film'),f=__filmFrames,s=__overlapStats,rec=document.getElementById('record').getAnimations().find(a=>a.animationName==='record-spin');
    return {ended:v.ended,lastMediaTime:f.at(-1),presented:f.length,fit:s.fit,cssAngleDeg:s.cssAngleDeg,maxConcurrentDecks:Math.max(...__music),recordRunning:rec?.playState==='running',drive:__living.state.drive,driveReady:__living.state.driveReady,engaged:__living.state.driveEngaged,surfaceStarts:__src.filter(x=>x.kind==='surface').length};});
  report.film[label]={status:status.text,...r,shots};
  assert.ok(r.ended&&r.lastMediaTime>=manifest.durationSec-2/manifest.fps,`${label}: film did not play to its last frame (${r.lastMediaTime})`);
  assert.ok(Math.abs(r.fit.scale-1)<1e-3&&Math.abs(r.fit.tx)<0.5&&Math.abs(r.fit.ty)<0.5,`${label}: C1 handoff off`);
  assert.ok(Math.abs(r.cssAngleDeg-91.0557374652127)<1e-6);assert.ok(r.maxConcurrentDecks<=1,`${label}: duplicate music`);
  assert.ok(r.recordRunning&&r.driveReady&&r.engaged,`${label}: record or drive not live after the film`);assert.ok(r.surfaceStarts>=1,`${label}: no vinyl surface`);
  for(const s of shots)assert.ok(s.bytes>100000,`${label}: near-empty frame at reveal+${s.at} ms`);
}
async function select(p,code){await p.locator('#queue-screen').focus();await p.keyboard.type(code);await p.keyboard.press('Enter');await p.waitForTimeout(150);return p.evaluate(()=>__skateNight.state().queue[0]);}
const settled=(p,id)=>p.waitForFunction(id=>__skateNight.state().nowId===id&&__skateNight.state().phase==='playing'&&!__living.state?.move&&__skateNight.player.currentTime>.3,id,{timeout:25000});
async function change(p,code,kind){
  const id=await select(p,code);
  await p.evaluate(()=>{window.__srcMark=__src.length;window.__moves=[];document.getElementById('mech').addEventListener('jukebox:mechanism',window.__mv=e=>{if(['eject','load'].includes(e.detail.action))__moves.push({a:e.detail.action,t:e.detail.at});});});await take(p);
  if(kind==='natural')await p.evaluate(()=>{const a=__decks.find(x=>!x.paused&&x.duration>20);if(!a)throw Error('no playing deck');a.currentTime=a.duration-2.5;});else await p.click('#btn-skip');
  await settled(p,id);await p.waitForTimeout(500);
  const t=analyse(await take(p)),s=await p.evaluate(()=>{document.getElementById('mech').removeEventListener('jukebox:mechanism',window.__mv);const src=__src.slice(__srcMark);
    // changer cue alignment: the first recorded-changer sound after each eject/load move begins
    return {cover:__living.state.volume,lagMs:__moves.map(m=>{const f=src.find(x=>x.kind==='sprite'&&x.t>=m.t-5);return f?+(f.t-m.t).toFixed(1):null;}),needles:src.filter(x=>x.kind==='needle').length};});
  return {kind,id,...t,...s};
}
const shellCaches=p=>p.evaluate(async()=>(await caches.keys()).filter(k=>k.startsWith('skatenight-')).sort());
const ready=p=>p.waitForFunction(()=>document.getElementById('offline-text').textContent==='OFFLINE READY',null,{timeout:300000});
try{
  // 0. Upgrade: the build being replaced is installed with songs and film saved; the same address then serves this build.
  if(server&&opt('--previous',null)){
    const cu=await b.newContext({viewport:{width:1280,height:720}});await cu.addInitScript(probe);let u=await open(cu);
    await u.evaluate(()=>document.getElementById('btn-crates').click());await ready(u);
    const before={caches:await shellCaches(u),songs:await u.evaluate(async()=>(await (await caches.open('skatenight-crates')).keys()).length),film:await u.evaluate(()=>document.getElementById('film-status').textContent),living:await u.evaluate(()=>Boolean(window.__living))};
    root=HERE;await u.reload();
    // The worker update (v49 -> v50) installs, activates and retires the old shell; poll, as the check is asynchronous.
    for(let t=0;;t+=500){const k=await shellCaches(u);if(k.includes('skatenight-shell-v50')&&!k.includes('skatenight-shell-v49')&&await u.evaluate(()=>Boolean(window.__living?.ready)))break;if(t>120000)throw Error(`shell did not upgrade: ${k}`);await u.waitForTimeout(500);}
    await ready(u);
    const after={caches:await shellCaches(u),songs:await u.evaluate(async()=>(await (await caches.open('skatenight-crates')).keys()).length),film:await u.evaluate(()=>document.getElementById('film-status').textContent),living:await u.evaluate(()=>__living.ready&&__living.offlineReady)};
    await cu.setOffline(true);await u.evaluate(()=>sessionStorage.clear());await u.reload();await u.waitForFunction(()=>window.__living?.ready&&document.getElementById('film-status').dataset.state==='ready',null,{timeout:90000});
    await film(u,'upgrade-offline-1280');
    report.checks.upgrade={before,after,offlineAfterUpgrade:true};
    assert.ok(!before.living&&after.living,'the default page did not become the photorealistic jukebox');
    assert.equal(after.songs,before.songs,'saved songs and covers were lost in the upgrade');assert.equal(before.songs,80,'70 songs and 10 covers');
    assert.match(after.film,/SHA 2A2FCA5B/,'saved film was lost in the upgrade');
    assert.deepEqual(after.caches,['skatenight-crates','skatenight-shell-v50']);
    assert.deepEqual(u.errors,[]);await cu.close();
  }
  // Installability of the default page (Chrome's own check).
  {const {mkdtemp,rm}=await import('node:fs/promises'),dir=await mkdtemp('/tmp/sn-install-');   // a real profile: incognito contexts are never installable
   const ci=await chromium.launchPersistentContext(dir,{channel:'chrome',headless:true});const pi=await open(ci);await pi.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:60000}).catch(()=>{});
   const cdp=await ci.newCDPSession(pi);report.checks.installability=(await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
   report.checks.manifest=await pi.evaluate(async()=>{const m=await (await fetch(document.querySelector('link[rel=manifest]').href)).json();return {start_url:m.start_url,scope:m.scope,display:m.display};});
   await ci.close();await rm(dir,{recursive:true,force:true});assert.deepEqual(report.checks.installability,[],'not installable');}
  // 1. Show state at 1920x1080: crates saved, film verified, visuals saved; film, drive, pause, changes, controls.
  const c=await b.newContext({viewport:{width:1920,height:1080}});await c.addInitScript(probe);let p=await open(c);
  await p.evaluate(()=>document.getElementById('btn-crates').click());
  await p.waitForFunction(()=>document.getElementById('offline-text').textContent==='OFFLINE READY'&&__living.offlineReady,null,{timeout:300000});
  report.checks.offlineReady=true;
  await film(p,'1920');await p.screenshot({path:`${OUT}/playing-1920.png`});
  report.checks.ambienceBeds=await p.evaluate(()=>__src.filter(x=>x.kind==='bed').length);assert.ok(report.checks.ambienceBeds>=2,'ambience did not start');
  await p.evaluate(sampler);await p.waitForTimeout(5000);report.checks.playing=analyse(await take(p));
  assert.ok(report.checks.playing.lockSpreadDeg<1e-6&&report.checks.playing.driveTravelDeg>1000,'drive not locked to the record');
  await p.click('#btn-play');await p.waitForTimeout(300);await take(p);await p.waitForTimeout(1500);const paused=await take(p);const pausedPlayer=await p.evaluate(()=>!__skateNight.player.isPlaying);
  await p.click('#btn-play');await p.waitForTimeout(1500);const resumed=await take(p);
  report.checks.pause={travelWhilePausedDeg:Math.max(...paused.map(s=>s.drive))-Math.min(...paused.map(s=>s.drive)),recordPaused:paused.every(s=>s.paused),playerPaused:pausedPlayer,travelAfterResumeDeg:resumed.at(-1).drive-resumed[0].drive};
  assert.ok(report.checks.pause.travelWhilePausedDeg<1e-9&&report.checks.pause.recordPaused&&pausedPlayer&&report.checks.pause.travelAfterResumeDeg>300,'pause/resume');
  report.checks.changes=[];for(const [code,kind] of [['B1','natural'],['C2','natural'],['E1','natural'],['H1','skip'],['J1','skip'],['L1','skip']])report.checks.changes.push(await change(p,code,kind));
  for(const ch of report.checks.changes){
    assert.deepEqual([...ch.moves].sort(),['eject','load'],JSON.stringify(ch));assert.ok(ch.poseChecks>20&&ch.poseErrDeg<1e-6,`${ch.id}: drive off the authored poses`);assert.ok(ch.lockSpreadDeg<1e-6,`${ch.id}: drive drifted`);
    assert.equal(ch.needles,1,`${ch.id}: needle drops ${ch.needles}`);assert.ok(ch.lagMs.length===2&&ch.lagMs.every(l=>l!==null&&l<50),`${ch.id}: changer sound ${ch.lagMs} ms from its move`);
  }
  assert.ok(new Set(report.checks.changes.map(c=>c.cover)).size>=5,'labels did not change');
  // Controls: two picks queue up, the music fader moves, BACK returns to the previous song.
  await select(p,'K1');await select(p,'G1');const queued=await p.evaluate(()=>__skateNight.state().queue.length);
  const fader=await p.evaluate(()=>{const el=document.getElementById('vol-music'),before=el.value;el.value=30;el.dispatchEvent(new Event('input',{bubbles:true}));const after=el.value;el.value=before;el.dispatchEvent(new Event('input',{bubbles:true}));return {before,after};});
  const backFrom=await p.evaluate(()=>__skateNight.state().nowId);await p.click('#btn-back');await p.waitForFunction(f=>__skateNight.state().nowId!==f&&__skateNight.state().phase==='playing'&&!__living.state.move,backFrom,{timeout:25000});
  report.checks.controls={queued,fader,back:{from:backFrom,to:await p.evaluate(()=>__skateNight.state().nowId)},sourcesLiveNow:await p.evaluate(()=>__live),maxSourcesLive:await p.evaluate(()=>__maxLive)};
  assert.ok(queued>=2);assert.ok(report.checks.controls.maxSourcesLive<24,'audio sources accumulate');
  assert.deepEqual(p.errors,[]);
  // 2. Offline reload: the same night with no network.
  await c.setOffline(true);await p.evaluate(()=>sessionStorage.clear());await p.reload();await p.waitForFunction(()=>window.__living?.ready&&document.getElementById('film-status').dataset.state==='ready',null,{timeout:90000});
  await film(p,'offline-1920');await p.evaluate(sampler);report.checks.offlineChanges=[await change(p,'D1','skip'),await change(p,'A2','natural')];
  for(const ch of report.checks.offlineChanges)assert.ok(ch.poseErrDeg<1e-6&&ch.lockSpreadDeg<1e-6&&ch.needles===1,`offline ${ch.id}`);
  assert.deepEqual(p.errors,[]);await c.close();
  // 3. 1280x720: film, drive and a change.
  const c7=await b.newContext({viewport:{width:1280,height:720}});await c7.addInitScript(probe);p=await open(c7);await film(p,'1280');await p.screenshot({path:`${OUT}/playing-1280.png`});
  await p.evaluate(sampler);report.checks.change1280=await change(p,'C1','skip');assert.ok(report.checks.change1280.poseErrDeg<1e-6&&report.checks.change1280.needles===1);assert.deepEqual(p.errors,[]);await c7.close();
  // 3b. The classic fallback: same app, film, music and changer, no photorealistic layer, online and offline.
  {const cc=await b.newContext({viewport:{width:1280,height:720}});await cc.addInitScript(probe);const q=await open(cc,'','classic-jukebox.html');
   await q.evaluate(()=>document.getElementById('btn-crates').click());await ready(q);
   assert.equal(await q.evaluate(()=>Boolean(window.__living)),false);
   await q.click('#attract');await q.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});await q.waitForTimeout(1500);
   const id=await select(q,'E2');await q.click('#btn-skip');await q.waitForFunction(id=>__skateNight.state().nowId===id&&__skateNight.state().phase==='playing'&&__skateNight.player.currentTime>.5,id,{timeout:25000});
   await cc.setOffline(true);await q.evaluate(()=>sessionStorage.clear());await q.reload();await q.waitForFunction(()=>window.__skateNight&&document.getElementById('film-status').dataset.state==='ready',null,{timeout:90000});
   await q.click('#attract');await q.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});
   report.checks.classic={film:await q.evaluate(()=>document.getElementById('film-status').textContent.slice(-20)),fit:await q.evaluate(()=>__overlapStats.fit),offlineReplay:true,playing:await q.evaluate(()=>__skateNight.player.isPlaying),errors:q.errors};
   assert.ok(report.checks.classic.playing);assert.deepEqual(q.errors,[]);await cc.close();}
  // 4. Missing and corrupt visual assets: the music and the production changer carry on.
  report.checks.fallback={};
  for(const [name,route] of [['missing drive layers',r=>r.request().url().includes('/living/assets/drive')?r.abort():r.continue()],['corrupt motion sheet',r=>r.request().url().endsWith('/living/assets/load-3.webp')?r.fulfill({status:200,contentType:'image/webp',body:Buffer.from('not a webp')}):r.continue()],['missing drive module',r=>r.request().url().endsWith('/living/drive.js')?r.abort():r.continue()]]){
    const cf=await b.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});/* the injected failure reaches the page, not a cached copy */await cf.addInitScript(probe);await cf.route('**/*',route);const q=await open(cf);
    await q.click('#attract');await q.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});await q.waitForTimeout(1500);   // input is held until the reveal
    const id=await select(q,'B2');await q.click('#btn-skip');await q.waitForFunction(id=>__skateNight.state().nowId===id&&__skateNight.state().phase==='playing'&&__skateNight.player.currentTime>.5,id,{timeout:25000});await q.waitForTimeout(1500);
    const st=await q.evaluate(()=>({playing:__skateNight.player.isPlaying,t:__skateNight.player.currentTime,living:window.__living?{ready:__living.ready,driveReady:__living.state?.driveReady??null,error:__living.error||null,failures:__living.stats?.failures||[]}:'module not loaded'}));
    report.checks.fallback[name]={...st,errors:q.errors};assert.ok(st.playing&&st.t>.5,`${name}: music interrupted`);await cf.close();
  }
  // 5. Main-thread cost with and without the drive (15 s of playback each).
  report.checks.cost={};
  for(const [w,h] of [[1280,720],[1920,1080]])for(const q of ['','?drive=0']){const cc=await b.newContext({viewport:{width:w,height:h}}),pp=await open(cc,q),cdp=await cc.newCDPSession(pp);await cdp.send('Performance.enable');
    await pp.click('#attract');await pp.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});await pp.waitForTimeout(2000);
    const m=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));const a=await m();await pp.waitForTimeout(15000);const z=await m();
    report.checks.cost[`${w}x${h} ${q?'static':'drive'}`]={taskMsPerSec:+((z.TaskDuration-a.TaskDuration)/15*1000).toFixed(1),scriptMsPerSec:+((z.ScriptDuration-a.ScriptDuration)/15*1000).toFixed(1),heapMB:+(z.JSHeapUsedSize/2**20).toFixed(1)};await cc.close();}
  report.passed=true;
}catch(e){report.passed=false;report.error=String(e.stack||e);process.exitCode=1;}
finally{await b.close();server?.close();}
await writeFile(`${OUT}/acceptance.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({passed:report.passed,error:report.error?.slice(0,900),film:Object.fromEntries(Object.entries(report.film).map(([k,v])=>[k,{presented:v.presented,last:v.lastMediaTime,decks:v.maxConcurrentDecks}])),cost:report.checks.cost},null,1));
