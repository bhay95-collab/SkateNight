#!/usr/bin/env node
// Actual PWA/OPFS/offline integration with a clearly labelled technical proxy.
// node scripts/check-extended-preview.mjs [--out DIR] [--viewports 1920x1080,1024x768]
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateAwakeningFilmManifest } from '../awakening-film.js';
import { registrationContinuity, songClockAlignment } from './film-continuity.mjs';
const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(opt('--out', 'build/awakening-35-development/integration'));
await mkdir(out, { recursive: true });
const cue = JSON.parse(await readFile(resolve(root, 'cinematic/extended/cues.json')));
const frame = (name) => Math.floor(cue.cues[name] * cue.fps + 0.5);
const suppliedMovie = opt('--movie', null);
const proxy = suppliedMovie ? resolve(suppliedMovie) : resolve(out, 'technical-effects-only-1080p30.mp4');
const manifestPath = resolve(opt('--manifest', proxy + '.json'));
async function run(cmd, params) {
  return new Promise((done, fail) => {
    const child = spawn(cmd, params, { stdio: ['ignore', 'pipe', 'pipe'] }); const stdout = [], stderr = [];
    child.stdout.on('data', (x) => stdout.push(x)); child.stderr.on('data', (x) => stderr.push(x));
    child.on('error', fail); child.on('close', (code) => code === 0 ? done(Buffer.concat(stdout).toString()) : fail(new Error(`${cmd} (${code}): ${Buffer.concat(stderr)}`)));
  });
}
// Synthetic slate, static registration disc and a quiet 440 Hz effects test tone.
// This is integration evidence only, never cinematic image or soundtrack approval.
const record = cue.c1.record;
if (!suppliedMovie) {
const rgb = Buffer.alloc(1920 * 1080 * 3);
const cx = record.cx * 1920, cy = record.cy * 1080, radius = record.r * 1920;
for (let y = 0; y < 1080; y++) for (let x = 0; x < 1920; x++) {
  const d = Math.hypot(x - cx, y - cy), at = (y * 1920 + x) * 3;
  let colour = [20, 47, 52];
  if (d < radius) colour = d < radius * 0.31 ? [178, 62, 41] : [12, 14, 16];
  if (d < radius && d > radius * 0.4 && Math.round(d) % 5 === 0) colour = [45, 48, 52];
  if (x < 25 || y < 25 || x >= 1895 || y >= 1055) colour = [211, 140, 63];
  for (let c = 0; c < 3; c++) rgb[at + c] = colour[c];
}
const ppm = resolve(out, 'technical-registration-slate.ppm');
await writeFile(ppm, Buffer.concat([Buffer.from('P6\n1920 1080\n255\n'), rgb]));
await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-y','-hide_banner','-loglevel','error','-loop','1','-framerate','30','-i',ppm,
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=35','-map','0:v','-map','1:a','-af','volume=0.04',
  '-frames:v','1050','-t','35','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-r','30',
  '-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-movflags','+faststart',proxy]);
}
const probe = JSON.parse(await run(process.env.FFPROBE_PATH || 'ffprobe', ['-v','error','-show_streams','-show_format','-of','json',proxy]));
const video = probe.streams.find((s) => s.codec_type === 'video'), audio = probe.streams.find((s) => s.codec_type === 'audio');
if (video.width !== 1920 || video.height !== 1080 || video.r_frame_rate !== '30/1' || Number(video.nb_frames) !== 1050
    || video.codec_name !== 'h264' || audio.codec_name !== 'aac' || audio.sample_rate !== '48000' || audio.channels !== 2) throw new Error('Technical proxy failed ffprobe.');
const manifest = suppliedMovie ? JSON.parse(await readFile(manifestPath)) : {
  manifestVersion:1, filmKind:'production-preview', filmId:cue.version, filmVersion:1, experimental:true,
  title:'TECHNICAL INTEGRATION PROXY — NOT CINEMATIC APPROVAL', width:1920,height:1080,fps:30,frameCount:1050,durationSec:35,
  videoCodec:'h264',audioCodec:'aac',audioSampleRate:48000,audioChannels:2,
  sha256:createHash('sha256').update(await readFile(proxy)).digest('hex'),
  audioOwnership:{film:'synthetic effects test tone only',openingSong:'jukebox audio engine',trackId:cue.opener.track_id,songEmbedded:false},
  cues:{coinSequenceStartFrame:0,firstFailureFrame:frame('failure'),recoveryFrame:frame('catch'),stylusContactFrame:frame('stylusContact'),
    firstSongCueFrame:frame('stylusContact'),musicHandoffFrame:Math.floor(cue.audio.songPlayback * 30),registrationStartFrame:frame('registrationStart'),finalCinematicFrame:1049},
  handoff:{mode:'overlap',songStartSec:cue.audio.songPlayback,videoFrame:Math.floor(cue.audio.songPlayback * 30),openerTrackId:cue.opener.track_id,
    interactiveState:`jukebox-playing:${cue.opener.track_id}`,record},
};
validateAwakeningFilmManifest(manifest,'production-preview');
if (!suppliedMovie) await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server = createServer(async (req,res) => {
  const url = new URL(req.url,'http://127.0.0.1'); const path = resolve(root,`.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (!path.startsWith(root + sep)) {res.writeHead(403).end();return;}
  try {const data = await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)] || 'application/octet-stream','content-length':data.length,'cache-control':'no-store'}).end(data);}
  catch {res.writeHead(404).end();}
});
await new Promise((done) => server.listen(0,'127.0.0.1',done));
const base = `http://127.0.0.1:${server.address().port}`;
let playwright;
if (process.env.PLAYWRIGHT_CORE_PATH) {
  playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE_PATH)).href);
} else {
  try {playwright = await import('playwright-core');}
  catch {playwright = await import(pathToFileURL('/Users/benjaminhay/SkateNight/node_modules/playwright-core/index.mjs').href);}
}
const browser = await playwright.chromium.launch({
  ...(process.env.CHROME_PATH ? {executablePath:resolve(process.env.CHROME_PATH)} : {channel:'chrome'}),
  headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results = [], failures = [];
const assert = (ok, message) => {if (!ok) failures.push(message);};
async function ready(page) {await page.waitForFunction(() => window.__skateNight && !document.getElementById('btn-film-import').disabled,null,{timeout:60000});}
async function play(page, label, coin = false) {
  await page.evaluate(({coin, registrationAt}) => {
    window.__samples=[]; window.__frames=[]; window.__stopSampling=false;
    const video=document.getElementById('production-preview-video');
    const onFrame=(now,meta) => {window.__frames.push([meta.expectedDisplayTime ?? now,meta.mediaTime]); if(!window.__stopSampling) video.requestVideoFrameCallback(onFrame);};
    video.requestVideoFrameCallback(onFrame);
    let spin=null;
    const tick=(wall) => {
      const p=window.__skateNight.player, v=video;
      const active=[...window.__media].filter((m) => !m.paused && !m.muted && !m.ended);
      if(!spin && v.currentTime>=registrationAt-1/30) spin=document.getElementById('record').getAnimations().find((a)=>a.animationName==='record-spin');
      const opacity=Number(getComputedStyle(v).opacity);
      window.__samples.push({wall,film:v.currentTime,playing:!v.paused,song:p?.currentTime,track:p?.currentTrackId,
        filmOpacity:opacity,spinMs:spin?.currentTime ?? null,
        activeAudio:active.filter((m) => m.tagName==='AUDIO').length, activeVideo:active.filter((m) => m.tagName==='VIDEO').length,
        covered:v.classList.contains('is-playing') && opacity>0,
        live:!document.body.classList.contains('on-attract') && document.getElementById('attract').classList.contains('is-revealed')});
      if(!window.__stopSampling) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
    document.getElementById(coin ? 'attract' : 'btn-film-preview').click();
    document.getElementById('cabinet-tools').open=false;
  }, {coin, registrationAt:manifest.cues.registrationStartFrame/manifest.fps});
  await page.waitForFunction(() => document.getElementById('production-preview-video').currentTime >= 34.6,null,{timeout:70000});
  // Screenshots stall Chrome's compositor; collect timing before any capture.
  await page.waitForFunction(() => window.__overlapStats?.revealMs,null,{timeout:20000});
  await page.waitForTimeout(400);
  const result=await page.evaluate(() => {
    window.__stopSampling=true;const box=document.getElementById('record-mover').getBoundingClientRect();
    const spin=document.getElementById('record').getAnimations().find((a)=>a.animationName==='record-spin');
    return {stats:window.__overlapStats,filmStats:window.__awakeningFilmStats,samples:window.__samples,frames:window.__frames,
      box:{cx:box.x+box.width/2,cy:box.y+box.height/2,r:box.width/2},spinMs:spin?.currentTime,now:performance.now(),
      state:window.__skateNight.state(),attractHidden:document.getElementById('attract').hidden};
  });
  await page.screenshot({path:resolve(out,`${label}-revealed.png`)});
  const locked=result.samples.filter((s)=>s.playing && s.track===cue.opener.track_id && s.song>0.15);
  const alignment=songClockAlignment(result,manifest);
  const offset=alignment.mediaOffsetSec, period=60000/record.rpm;
  const phase=((result.spinMs%period)/period)*360;
  const expected=(record.cssAngleDeg+(result.now-result.stats.filmEndedMs)/period*360)%360;
  const near=result.frames.filter(([,m])=>Math.abs(m-cue.audio.songPlayback)<0.5);
  const gaps=near.slice(1).map(([t],i)=>t-near[i][0]);
  const registration=registrationContinuity(result,manifest);
  const summary={label,alignment,songStartErrorMs:alignment.mediaStartErrorMs,
    contactSongSec:31.6-offset,revealAfterEndMs:result.stats.revealMs-result.stats.filmEndedMs,
    outputLatencyMs:result.stats.outputLatencySec*1000,
    estimatedAudibleStartErrorMs:alignment.estimatedAudibleStartErrorMs,
    scheduledSongOffsetMs:result.stats.songOffsetMs,
    centreErrorPx:Math.hypot(result.stats.fit.mask.cx-result.box.cx,result.stats.fit.mask.cy-result.box.cy),
    radiusErrorPx:Math.abs(result.stats.fit.mask.r-result.box.r),spinErrorDeg:Math.abs(((phase-expected+540)%360)-180),
    maxPlayingSongs:Math.max(...locked.map((s)=>s.activeAudio)),effectAndSong:locked.some((s)=>s.activeAudio===1 && s.activeVideo===1),
    uncoveredSamples:result.samples.filter((s)=>s.film>0.1 && !s.covered && !s.live).length,
    maxGapNearSongMs:Math.max(...gaps),registration,lockedSamples:locked.length,filmStats:result.filmStats,state:result.state,attractHidden:result.attractHidden};
  assert(Number.isFinite(summary.estimatedAudibleStartErrorMs) && Math.abs(summary.estimatedAudibleStartErrorMs)<=1000/30,`${label}: estimated audible song start error ${summary.estimatedAudibleStartErrorMs} ms`);
  assert(Number.isFinite(alignment.presentedEstimatedAudibleStartErrorMs)
    && Math.abs(alignment.presentedEstimatedAudibleStartErrorMs)<=1000/30,
    `${label}: presented-frame estimated audible song start error ${alignment.presentedEstimatedAudibleStartErrorMs} ms`);
  assert(Math.abs(summary.revealAfterEndMs)<=100,`${label}: delayed reveal`);
  assert(summary.centreErrorPx<1 && summary.radiusErrorPx<1,`${label}: registration geometry`);
  assert(summary.spinErrorDeg<6,`${label}: spin phase`);
  assert(summary.effectAndSong && summary.maxPlayingSongs===1,`${label}: independent single song and effects ownership`);
  assert(summary.uncoveredSamples===0,`${label}: uncovered/black gap`);
  assert(summary.maxGapNearSongMs<100,`${label}: presentation gap near song`);
  const registrationBudgetMs=2000/manifest.fps+1;
  assert(registration.maxGapMs!==null && registration.maxGapMs<=registrationBudgetMs,
    `${label}: registration presentation stall ${registration.maxGapMs} ms`);
  assert(registration.maxMediaStepFrames!==null && registration.maxMediaStepFrames<=2.01 && registration.finalFramePresented,
    `${label}: registration skipped native samples or omitted final frame`);
  assert(registration.clockSamples>=2 && registration.maxEstimatedAudibleDriftMs<=registrationBudgetMs,
    `${label}: registration audible drift ${registration.maxEstimatedAudibleDriftMs} ms`);
  assert(registration.liveBackgroundReady,`${label}: live background unavailable during registration`);
  assert(registration.exposedPhaseSamples>=2 && Number.isFinite(registration.maxExposedPhaseErrorDeg)
    && registration.maxExposedPhaseErrorDeg<6,`${label}: exposed-record crossfade phase ${registration.maxExposedPhaseErrorDeg} degrees`);
  assert(summary.attractHidden && summary.state.phase==='playing',`${label}: live controls not landed`);
  await writeFile(resolve(out,`${label}-samples.json`),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(summary));return summary;
}
async function faultBeforeGate(page) {
  await page.evaluate(()=>document.getElementById('btn-film-preview').click());
  await page.waitForFunction(()=>!document.getElementById('production-preview-video').paused);
  const injectedAt=Date.now();
  const before=await page.evaluate(()=>{
    const video=document.getElementById('production-preview-video');
    // Inject the failure after prepareSong, but before the song-start cue. This
    // is a fault-path test; seeking here is not evidence of normal sync.
    video.pause();video.currentTime=30.7;
    video.dispatchEvent(new Event('timeupdate'));
    const gateWasClosed=window.__overlapStats.songGateOpenedMs==null;
    video.dispatchEvent(new Event('error'));
    return {gateWasClosed};
  });
  await page.waitForFunction(()=>window.__overlapStats?.revealMs && document.getElementById('attract').hidden
    && window.__skateNight.state().phase==='playing',null,{timeout:8000});
  const result=await page.evaluate(()=>({stats:window.__overlapStats,state:window.__skateNight.state(),
    activeSongs:[...window.__media].filter((m)=>m.tagName==='AUDIO' && !m.paused && !m.ended).length,
    filmStopped:document.getElementById('production-preview-video').paused,
    bodyRevealed:!document.body.classList.contains('on-attract'),
    controlsReleased:!document.getElementById('btn-play').closest('[inert]')}));
  await page.evaluate(()=>document.getElementById('btn-play').click());
  await page.waitForFunction(()=>window.__skateNight.state().phase==='paused');
  assert(before.gateWasClosed && result.stats.playbackFailed && result.stats.songGateOpenedMs!=null,'Before-gate decode failure did not open its prepared song gate');
  assert(result.activeSongs===1 && result.filmStopped && result.bodyRevealed && result.controlsReleased,'Decode fallback did not restore one song and live controls');
  await page.screenshot({path:resolve(out,'before-gate-decode-fallback.png')});
  return {label:'before-gate-decode-fallback',...before,...result,finishedWithinMs:Date.now()-injectedAt};
}

try {
  const viewports=opt('--viewports','1920x1080,1440x900,1280x800,1024x768').split(',').map((x)=>x.split('x').map(Number));
  for (let i=0;i<viewports.length;i++) {
    const [width,height]=viewports[i]; const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript(() => {
      sessionStorage.setItem('sn_booted','1'); window.__media=new Set();const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(...args){window.__media.add(this);return play.apply(this,args);};
    });
    const page=await context.newPage(), errors=[], consoleErrors=[];page.on('pageerror',(e)=>errors.push(e.message));
    page.on('console',(message)=>{if(message.type()==='error') consoleErrors.push(message.text());});
    await page.goto(base,{waitUntil:'load'});await ready(page);
    // Existing crates API: save the actual opener before playback/offline reload.
    await page.evaluate(async () => {
      const {loadCrates}=await import('./crates.js'); const track=window.__skateNight.library.tracks.find((t)=>t.id==='praise-lifted-on-high');
      const r=await loadCrates([{url:new URL(track.file,location.href).href,kind:'audio'}]);if(r.failed.length) throw new Error('Opener crate preload failed');
    });
    await page.evaluate(()=>document.getElementById('cabinet-tools').open=true);
    await page.setInputFiles('#film-files',[proxy,manifestPath]);
    await page.waitForFunction(()=>!document.getElementById('btn-film-preview').disabled,null,{timeout:120000});
    if(args.includes('--fault-only')) {
      results.push(await faultBeforeGate(page));
      results.push({label:'fault-diagnostics',pageErrors:errors,consoleErrors});
      assert(errors.length===0,'Fault fallback caused a page exception');
      await writeFile(resolve(out,'integration-proof.json'),JSON.stringify({generatedSyntheticProxy:!suppliedMovie,assetQuality:manifest.qualityTier || (suppliedMovie ? 'external-preview' : 'synthetic-technical-proxy'),cinematicApproval:false,movie:proxy,manifest:manifestPath,probe,results,failures},null,2)+'\n');
      await context.close();break;
    }
    results.push(await play(page,`${width}x${height}`));
    // Normal controls must be released after the film, including the actual music bus.
    await page.evaluate(()=>document.getElementById('btn-play').click());
    await page.waitForFunction(()=>window.__skateNight.state().phase==='paused');
    await page.evaluate(()=>document.getElementById('btn-play').click());
    await page.waitForFunction(()=>window.__skateNight.state().phase==='playing');
    const controls=await page.evaluate(async()=>{
      const slider=document.getElementById('vol-music');slider.value='45';slider.dispatchEvent(new Event('input',{bubbles:true}));
      const {getEngine}=await import('./audio.js');return {musicLevel:getEngine().musicLevel,inert:document.getElementById('btn-play').closest('[inert]')!==null};
    });
    assert(controls.musicLevel===0.45 && !controls.inert,`${width}x${height}: controls/music fader`);
    if(i===0 && !args.includes('--skip-offline')) {
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;sessionStorage.removeItem('sn_opened');});
      await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
      await context.setOffline(true);await page.goto(`${base}/?film=extended35`,{waitUntil:'load'});await ready(page);
      assert(await page.locator('#btn-film-preview').isEnabled(),'OPFS preview not prepared on offline reload');
      results.push(await play(page,'offline-opfs-reload-coin-opt-in',true));
      const storage=await page.evaluate(async()=>{
        const dir=await navigator.storage.getDirectory();const names=[];for await(const [name] of dir.entries()) names.push(name);
        for(const name of names) if(name.startsWith('cinematic-preview-')) await dir.removeEntry(name);
        sessionStorage.removeItem('sn_opened');return names;
      });
      await page.reload({waitUntil:'load'});await ready(page);
      assert(await page.locator('#btn-film-preview').isDisabled(),'Missing preview was not rejected safely');
      await page.locator('#attract').click();
      await page.waitForFunction(()=>document.getElementById('attract').hidden && window.__skateNight.state().phase==='playing',null,{timeout:40000});
      const fallback=await page.evaluate(()=>({state:window.__skateNight.state(),
        usedLive:!window.__awakeningFilmStats && !window.__overlapStats,
        filmStopped:document.getElementById('production-preview-video').paused,
        controlsReleased:!document.getElementById('btn-play').closest('[inert]')}));
      assert(fallback.usedLive && fallback.filmStopped && fallback.controlsReleased && fallback.state.nowId===cue.opener.track_id,'Missing film failed to use the normal live cut and opener');
      await page.evaluate(()=>document.getElementById('btn-play').click());
      await page.waitForFunction(()=>window.__skateNight.state().phase==='paused');
      results.push({label:'offline-missing-film-fallback',passed:true,storedNames:storage,...fallback});
      await page.screenshot({path:resolve(out,'offline-live-fallback.png')});
    }
    results.push({label:`${width}x${height}-diagnostics`,pageErrors:errors,consoleErrors});
    assert(errors.length===0,`${width}x${height}: page errors ${errors.join('; ')}`);
    await writeFile(resolve(out,'integration-proof.json'),JSON.stringify({generatedSyntheticProxy:!suppliedMovie,assetQuality:manifest.qualityTier || (suppliedMovie ? 'external-preview' : 'synthetic-technical-proxy'),cinematicApproval:false,movie:proxy,manifest:manifestPath,probe,results,failures},null,2)+'\n');
    await context.close();
  }
} finally {await browser.close();await new Promise((done)=>server.close(done));}
if(failures.length) throw new Error(failures.join('\n'));
console.log(`PASSED selected native30 PWA checks: ${out}`);
