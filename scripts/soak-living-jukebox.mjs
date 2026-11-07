#!/usr/bin/env node
/* Event-length soak of living-jukebox.html in real Google Chrome, written to disk every minute.
     node scripts/soak-living-jukebox.mjs [--minutes 120] [--base http://127.0.0.1:8099] [--out build/living-jukebox/soak]
   Film, then continuous playback: songs end naturally, picks every 4 min, a skip every 7 min, a 20 s pause every 11 min.
   Each minute: JS heap after GC, Chrome resident memory, main-thread time, slow frames, audio stalls and duplicate decks,
   drive lock, live audio buffer sources, changes, warnings and errors. */
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const args=process.argv.slice(2),opt=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
const MINUTES=Number(opt('--minutes',120)),BASE=opt('--base','http://127.0.0.1:8099'),OUT=resolve(opt('--out','build/living-jukebox/soak'));await mkdir(OUT,{recursive:true});
const CODES='A B C D E G H J K L'.split(' ').flatMap(l=>[1,2,3,4,5].map(n=>l+n));
const report={base:BASE,minutes:MINUTES,started:new Date().toISOString(),samples:[],events:[],messages:[]};
const save=()=>writeFile(`${OUT}/soak.json`,JSON.stringify(report,null,1)+'\n');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});report.browser=b.version();
const c=await b.newContext({viewport:{width:1920,height:1080}});
await c.addInitScript(()=>{
  const Native=Audio;window.__decks=[];window.Audio=function(...a){const x=new Native(...a);__decks.push(x);return x;};window.Audio.prototype=Native.prototype;
  window.__live=0;const {start}=AudioBufferSourceNode.prototype;
  AudioBufferSourceNode.prototype.start=function(...a){__live++;this.addEventListener('ended',()=>__live--,{once:true});return start.apply(this,a);};
});
const p=await c.newPage(),cdp=await c.newCDPSession(p),system=await b.newBrowserCDPSession();await cdp.send('Performance.enable');
p.on('pageerror',e=>report.messages.push({t:Date.now(),type:'pageerror',text:String(e)}));
// Optional media (custom effect MP3 overrides) is expected to 404; those URLs are listed, not counted as errors.
report.notFound=[];p.on('response',r=>{if(r.status()===404&&!report.notFound.includes(r.url()))report.notFound.push(r.url());});
p.on('console',m=>{if(['error','warning'].includes(m.type())&&!m.text().startsWith('Failed to load resource'))report.messages.push({t:Date.now(),type:m.type(),text:m.text().slice(0,300)});});
const resident=async()=>{const ids=(await system.send('SystemInfo.getProcessInfo')).processInfo.map(x=>x.id);return execFileSync('ps',['-o','rss=','-p',ids.join(',')],{encoding:'utf8'}).trim().split(/\s+/).reduce((s,x)=>s+Number(x),0)*1024;};
const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
const event=(kind,detail={})=>report.events.push({t:Date.now(),kind,...detail});
try{
  await p.goto(`${BASE}/living-jukebox.html`);
  await p.waitForFunction(()=>window.__living?.ready&&document.getElementById('film-status').dataset.state==='ready',null,{timeout:120000});
  await p.click('#attract');await p.waitForFunction(()=>window.__overlapStats?.revealMs,null,{timeout:60000});event('film');
  // In-page monitor: frame intervals, drive lock per engaged run, audio progress and concurrent decks, changes.
  await p.evaluate(()=>{
    const rec=document.getElementById('record'),m=window.__mon={frames:0,slow:0,slowMoving:0,last:0,spread:0,run:[],stalls:0,maxDecks:0,changes:0,lastTrack:null,lastSong:-1};
    const close=()=>{if(m.run.length)m.spread=Math.max(m.spread,Math.max(...m.run)-Math.min(...m.run));m.run=[];};
    const tick=now=>{const s=__living.state,a=rec.getAnimations().find(x=>x.animationName==='record-spin');
      if(m.last){m.frames++;if(now-m.last>33.4){m.slow++;if(s.move)m.slowMoving++;}}m.last=now;
      if(s.driveEngaged&&!s.move&&a?.playState==='running'){const off=s.drive-(Number(a.currentTime)/1333.333*360+s.labelOffset);m.run.push(off);if(m.run.length>900){close();m.run=[off];}}else close();
      requestAnimationFrame(tick);};requestAnimationFrame(tick);
    setInterval(()=>{const st=__skateNight.state(),pl=__skateNight.player;m.maxDecks=Math.max(m.maxDecks,__decks.filter(x=>!x.paused&&!x.muted).length);
      if(st.nowId!==m.lastTrack){if(m.lastTrack)m.changes++;m.lastTrack=st.nowId;m.lastSong=-1;}
      // Playing, unpaused and past the vinyl lead-in: the song clock must move about a second per second.
      const playing=st.phase==='playing'&&!document.getElementById('mech').classList.contains('is-paused')&&pl.isPlaying&&pl.currentTime>1.5;
      if(playing&&m.lastSong>1.5&&pl.currentTime-m.lastSong<0.5)m.stalls++;m.lastSong=playing?pl.currentTime:-1;},1000);
  });
  let before=await metrics();const wall=Date.now();
  for(let minute=1;minute<=MINUTES;minute++){
    await p.waitForTimeout(Math.max(1000,wall+minute*60000-Date.now()));
    try{
      if(minute%4===0){const n=1+minute%3;for(let i=0;i<n;i++){await p.locator('#queue-screen').focus();await p.keyboard.type(CODES[(minute*7+i*13)%CODES.length]);await p.keyboard.press('Enter');await p.waitForTimeout(200);}event('picks',{n});}
      if(minute%7===0){await p.click('#btn-skip');event('skip');}
      if(minute%11===0){await p.click('#btn-play');event('pause');await p.waitForTimeout(20000);await p.click('#btn-play');event('resume');}
    }catch(error){event('action-failed',{error:String(error).slice(0,200)});}
    await cdp.send('HeapProfiler.collectGarbage');const now=await metrics();
    const mon=await p.evaluate(()=>{const m=__mon,st=__skateNight.state();return {frames:m.frames,slow:m.slow,slowMoving:m.slowMoving,spread:m.spread,stalls:m.stalls,maxDecks:m.maxDecks,changes:m.changes,live:__live,nowId:st.nowId,phase:st.phase,queue:st.queue.length,failures:__living.stats.failures.length};});
    report.samples.push({minute,heapMB:+(now.JSHeapUsedSize/2**20).toFixed(2),residentMB:+((await resident())/2**20).toFixed(0),nodes:now.Nodes,listeners:now.JSEventListeners,taskMsPerSec:+((now.TaskDuration-before.TaskDuration)/60*1000).toFixed(1),...mon});
    before=now;await save();
  }
  const s=report.samples,first=s.find(x=>x.minute===5)||s[0],last=s.at(-1);
  report.summary={minutes:s.length,changes:last.changes,heapMB:[first.heapMB,last.heapMB],residentMB:[first.residentMB,last.residentMB,Math.max(...s.map(x=>x.residentMB))],nodes:[first.nodes,last.nodes],listeners:[first.listeners,last.listeners],slowFrames:[last.slow,last.frames],audioStalls:last.stalls,maxConcurrentDecks:last.maxDecks,maxDriveSpreadDeg:last.spread,maxLiveSources:Math.max(...s.map(x=>x.live)),failures:last.failures,errors:report.messages.filter(m=>m.type!=='warning').length,warnings:report.messages.filter(m=>m.type==='warning').length,taskMsPerSec:+(s.reduce((a,x)=>a+x.taskMsPerSec,0)/s.length).toFixed(1)};
  report.summary.notFound=report.notFound.map(u=>new URL(u).pathname);report.passed=report.notFound.every(u=>/\/sfx\/[^/]+\.mp3$/.test(u))&&last.stalls===0&&last.maxDecks<=1&&last.spread<1e-6&&last.failures===0&&report.summary.errors===0;
}catch(e){report.passed=false;report.error=String(e.stack||e);process.exitCode=1;}
finally{report.finished=new Date().toISOString();await save();await b.close();}
console.log(JSON.stringify(report.summary||report.error));
