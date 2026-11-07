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
const offlineRuns = Number(opt('--offline-runs', '1'));
if (!Number.isInteger(offlineRuns) || offlineRuns < 1) throw new Error('--offline-runs must be a positive integer.');
const offlineOnly = args.includes('--offline-only');
// --hosted: the real show path - films/manifest.json, background download, OPFS, the coin, offline reloads.
const hosted = args.includes('--hosted');
const filmEl = hosted ? 'awakening-film' : 'production-preview-video';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(opt('--out', 'build/awakening-35-development/integration'));
await mkdir(out, { recursive: true });
const cue = JSON.parse(await readFile(resolve(root, 'cinematic/extended/cues.json')));
const frame = (name) => Math.floor(cue.cues[name] * cue.fps + 0.5);
const hostedManifest = hosted ? JSON.parse(await readFile(resolve(root, 'films/manifest.json'))) : null;
const suppliedMovie = hosted ? resolve(root, 'films', hostedManifest.videoFile) : opt('--movie', null);
const proxy = suppliedMovie ? resolve(suppliedMovie) : resolve(out, 'technical-effects-only-1080p30.mp4');
const manifestPath = hosted ? resolve(root, 'films/manifest.json') : resolve(opt('--manifest', proxy + '.json'));
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
validateAwakeningFilmManifest(manifest,hosted ? 'awakening' : 'production-preview');
if (!suppliedMovie) await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server = createServer(async (req,res) => {
  const url = new URL(req.url,'http://127.0.0.1'); const path = resolve(root,`.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (!path.startsWith(root + sep)) {res.writeHead(403).end();return;}
  try {const data = await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)] || 'application/octet-stream','content-length':data.length,'cache-control':'no-store'}).end(data);}
  catch {res.writeHead(404).end();}
});
await new Promise((done) => server.listen(0,'127.0.0.1',done));
// --base URL: check a deployed site (e.g. the live GitHub Pages URL) instead of this worktree.
// Keep the trailing slash: the service worker's scope is the site folder, and
// the folder URL without it is outside that scope offline.
const base = opt('--base', null)?.replace(/\/?$/, '/') || `http://127.0.0.1:${server.address().port}`;
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
// The launch website check runs in the background; wait for its verdict, not just the page.
const ledShows = (page, text) => page.waitForFunction((t) => document.getElementById('offline-text').textContent === t, text, {timeout:20000})
  .then(() => true, () => false);
// Prepare for Show: LOAD THE CRATES, then the LED must confirm the whole show offline.
async function prepareCrates(page) {
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;document.getElementById('cabinet-tools').open=true;document.getElementById('btn-crates').click();});
  await page.waitForFunction(()=>!document.getElementById('btn-crates').disabled && document.getElementById('offline-text').textContent!=='',null,{timeout:300000});
  const prepared=await ledShows(page,'OFFLINE READY');
  const library=await page.evaluate(async()=>{
    const {listCrateFiles,crateStatus}=await import('./crates.js');
    const library=window.__skateNight.library;
    return {tracks:library.tracks.length,...await crateStatus(listCrateFiles(library))};
  });
  results.push({label:'prepare-for-show-crates',offlineReady:prepared,library,led:await page.locator('#offline-text').textContent()});
  assert(prepared,'Prepare for Show: LED did not confirm OFFLINE READY with songs and film saved');
  assert(library.saved===library.total && library.tracks>0,'Prepare for Show: not every library asset is saved');
  // Show-like state: songs were saved earlier, not seconds before the coin.
  await page.waitForTimeout(Number(opt('--settle-sec','0'))*1000);
  await page.evaluate(()=>{document.getElementById('cabinet-tools').open=false;sessionStorage.removeItem('sn_opened');});
  await page.reload({waitUntil:'load'});await ready(page);await filmSettled(page);
}
async function filmSettled(page) {await page.waitForFunction(() => document.getElementById('film-status').dataset.state !== 'checking',null,{timeout:180000});
  return page.evaluate(() => ({state:document.getElementById('film-status').dataset.state,text:document.getElementById('film-status').textContent,
    led:document.getElementById('offline-text').textContent}));}
async function play(page, label, coin = false) {
  await page.evaluate(async ({coin, registrationAt, songAt}) => {
    const { getEngine } = await import('./audio.js');
    window.__getAudioEngine = getEngine;
    window.__samples=[]; window.__frames=[]; window.__mediaEvents=[]; window.__stopSampling=false;
    const video=document.getElementById(window.__filmEl);
    const onFrame=(now,meta) => {window.__frames.push([meta.expectedDisplayTime ?? now,meta.mediaTime,{callbackNow:now,observedAt:performance.now(),presentationTime:meta.presentationTime,presentedFrames:meta.presentedFrames}]); if(!window.__stopSampling) video.requestVideoFrameCallback(onFrame);};
    video.requestVideoFrameCallback(onFrame);
    let spin=null;
    const pcm = new Float32Array(1024);
    const tick=(wall) => {
      const p=window.__skateNight.player, v=video;
      const active=[...window.__media].filter((m) => !m.paused && !m.muted && !m.ended);
      if(!spin && v.currentTime>=registrationAt-1/30) spin=document.getElementById('record').getAnimations().find((a)=>a.animationName==='record-spin');
      const opacity=Number(getComputedStyle(v).opacity);
      const engine = getEngine();
      let audioClock = null;
      if (engine && v.currentTime >= songAt - 1) {
        const timestamp = engine.ctx.getOutputTimestamp?.();
        engine.analyser.getFloatTimeDomainData(pcm);
        let energy = 0, peak = 0;
        for (const value of pcm) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
        audioClock = { contextTime: engine.ctx.currentTime, baseLatency: engine.ctx.baseLatency,
          outputLatency: engine.ctx.outputLatency, sampleRate: engine.ctx.sampleRate,
          outputContextTime: timestamp?.contextTime, outputPerformanceTime: timestamp?.performanceTime,
          rms: Math.sqrt(energy / pcm.length), peak };
      }
      window.__samples.push({wall,audioClock,film:v.currentTime,playing:!v.paused,song:p?.currentTime,track:p?.currentTrackId,
        filmOpacity:opacity,spinMs:spin?.currentTime ?? null,
        activeAudio:active.filter((m) => m.tagName==='AUDIO').length, activeVideo:active.filter((m) => m.tagName==='VIDEO').length,
        covered:v.classList.contains('is-playing') && opacity>0,
        live:!document.body.classList.contains('on-attract') && document.getElementById('attract').classList.contains('is-revealed')});
      if(!window.__stopSampling) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
    document.getElementById(coin ? 'attract' : 'btn-film-preview').click();
    document.getElementById('cabinet-tools').open=false;
  }, {coin:coin || hosted, registrationAt:manifest.cues.registrationStartFrame/manifest.fps, songAt:manifest.handoff.songStartSec});
  await page.waitForFunction(() => document.getElementById(window.__filmEl).currentTime >= 34.6,null,{timeout:70000});
  // Screenshots stall Chrome's compositor; collect timing before any capture.
  await page.waitForFunction(() => window.__overlapStats?.revealMs,null,{timeout:20000});
  await page.waitForTimeout(400);
  const result=await page.evaluate(() => {
    window.__stopSampling=true;const box=document.getElementById('record-mover').getBoundingClientRect();
    const spin=document.getElementById('record').getAnimations().find((a)=>a.animationName==='record-spin');
    return {stats:window.__overlapStats,filmStats:window.__awakeningFilmStats,samples:window.__samples,frames:window.__frames,
      cueEvents:window.__awakeningCueEvents,mediaEvents:window.__mediaEvents,
      pcmCapture:window.__pcmCapture ? { ...window.__pcmCapture,
        music:Array.from(window.__pcmCapture.music), output:Array.from(window.__pcmCapture.output) } : null,
      box:{cx:box.x+box.width/2,cy:box.y+box.height/2,r:box.width/2},spinMs:spin?.currentTime,now:performance.now(),
      state:window.__skateNight.state(),attractHidden:document.getElementById('attract').hidden};
  });
  if (result.pcmCapture) {
    for (const channel of ['music', 'output']) {
      const name = `${label}-${channel}.f32le`;
      const values = new Float32Array(result.pcmCapture[channel]);
      await writeFile(resolve(out, name), Buffer.from(values.buffer));
      delete result.pcmCapture[channel];
      result.pcmCapture[`${channel}File`] = name;
    }
  }
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
  await page.evaluate((trigger)=>document.getElementById(trigger).click(), hosted ? 'attract' : 'btn-film-preview');
  await page.waitForFunction(()=>!document.getElementById(window.__filmEl).paused);
  const injectedAt=Date.now();
  await page.evaluate(()=>{
    const video=document.getElementById(window.__filmEl);
    // Inject the failure after prepareSong, but before the song-start cue. This
    // is a fault-path test; seeking here is not evidence of normal sync.
    video.pause();video.currentTime=30.7;
  });
  await page.waitForFunction(() => window.__awakeningCueEvents?.some((event) => Math.abs(event.at - (31.393 - 0.75)) < 0.001),
    null, { timeout: 5000 });
  const before=await page.evaluate(()=>{
    const video=document.getElementById(window.__filmEl);
    const preparation = window.__awakeningCueEvents.find((event) => Math.abs(event.at - (31.393 - 0.75)) < 0.001);
    const gateWasClosed=window.__overlapStats.songGateOpenedMs==null;
    video.dispatchEvent(new Event('error'));
    return {gateWasClosed, preparationSource: preparation.source, hasFrameCallback: typeof video.requestVideoFrameCallback === 'function'};
  });
  await page.waitForFunction(()=>window.__overlapStats?.revealMs && document.getElementById('attract').hidden
    && window.__skateNight.state().phase==='playing',null,{timeout:8000});
  const result=await page.evaluate(()=>({stats:window.__overlapStats,state:window.__skateNight.state(),
    activeSongs:[...window.__media].filter((m)=>m.tagName==='AUDIO' && !m.paused && !m.ended).length,
    filmStopped:document.getElementById(window.__filmEl).paused,
    bodyRevealed:!document.body.classList.contains('on-attract'),
    controlsReleased:!document.getElementById('btn-play').closest('[inert]')}));
  await page.evaluate(()=>document.getElementById('btn-play').click());
  await page.waitForFunction(()=>window.__skateNight.state().phase==='paused');
  assert(before.gateWasClosed && result.stats.playbackFailed && result.stats.songGateOpenedMs!=null,'Before-gate decode failure did not open its prepared song gate');
  assert(before.preparationSource === (before.hasFrameCallback ? 'rvfc' : 'timeupdate'), 'Decode fault did not prepare on the authoritative cue clock');
  assert(result.activeSongs===1 && result.filmStopped && result.bodyRevealed && result.controlsReleased,'Decode fallback did not restore one song and live controls');
  await page.screenshot({path:resolve(out,'before-gate-decode-fallback.png')});
  return {label:'before-gate-decode-fallback',...before,...result,finishedWithinMs:Date.now()-injectedAt};
}

try {
  const viewports=opt('--viewports','1920x1080,1440x900,1280x800,1024x768').split(',').map((x)=>x.split('x').map(Number));
  for (let i=0;i<viewports.length;i++) {
    const [width,height]=viewports[i]; const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript((filmElId) => {
      sessionStorage.setItem('sn_booted','1'); window.__media=new Set(); window.__filmEl=filmElId;const play=HTMLMediaElement.prototype.play;
      const Context = window.AudioContext || window.webkitAudioContext;
      const createCompressor = Context.prototype.createDynamicsCompressor;
      Context.prototype.createDynamicsCompressor = function(...args) {
        const limiter = createCompressor.apply(this, args);
        if (!window.__pcmProbePromise && this.audioWorklet) {
          const context = this;
          const code = `class FilmTimingProbe extends AudioWorkletProcessor {
            constructor() {
              super();
              this.capture = null;
              this.port.onmessage = () => { this.capture = { position: 0, startFrame: null,
                music: new Float32Array(sampleRate), output: new Float32Array(sampleRate) }; };
            }
            process(inputs) {
              const capture = this.capture;
              if (!capture) return true;
              if (capture.startFrame === null) capture.startFrame = currentFrame;
              const count = Math.min(128, capture.music.length - capture.position);
              for (let input = 0; input < 2; input++) {
                const channels = inputs[input];
                const target = input === 0 ? capture.music : capture.output;
                for (let i = 0; i < count; i++) {
                  let value = 0;
                  for (const channel of channels) value += channel[i] || 0;
                  target[capture.position + i] = channels.length ? value / channels.length : 0;
                }
              }
              capture.position += count;
              if (capture.position === capture.music.length) {
                this.port.postMessage({ contextStartSec: capture.startFrame / sampleRate, sampleRate,
                  music: capture.music.buffer, output: capture.output.buffer }, [capture.music.buffer, capture.output.buffer]);
                this.capture = null;
              }
              return true;
            }
          }
          registerProcessor('film-timing-probe', FilmTimingProbe);`;
          const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
          window.__pcmProbePromise = context.audioWorklet.addModule(url).then(() => {
            const engine = window.__getAudioEngine();
            const probe = new AudioWorkletNode(context, 'film-timing-probe', { numberOfInputs: 2, numberOfOutputs: 1 });
            engine.musicBus.connect(probe, 0, 0);
            limiter.connect(probe, 0, 1);
            const silent = context.createGain();
            silent.gain.value = 0;
            probe.connect(silent).connect(context.destination);
            probe.port.onmessage = ({ data }) => { window.__pcmCapture = { ...data,
              music: new Float32Array(data.music), output: new Float32Array(data.output) }; };
            window.__pcmProbe = probe;
          }).catch((error) => { window.__pcmProbeError = error.message; }).finally(() => URL.revokeObjectURL(url));
        }
        return limiter;
      };
      const observed = new WeakSet();
      HTMLMediaElement.prototype.play = function(...args) {
        window.__media.add(this);
        const record = (event) => {
          const context = window.__getAudioEngine?.()?.ctx;
          const timestamp = context?.getOutputTimestamp?.();
          window.__mediaEvents?.push({ event, wall: performance.now(),
            tag: this.tagName, id: this.id, currentTime: this.currentTime, readyState: this.readyState, paused: this.paused,
            contextTime: context?.currentTime, baseLatency: context?.baseLatency, outputLatency: context?.outputLatency,
            outputContextTime: timestamp?.contextTime, outputPerformanceTime: timestamp?.performanceTime });
        };
        if (!observed.has(this)) {
          observed.add(this);
          for (const event of ['playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked']) this.addEventListener(event, () => record(event));
        }
        record('play-called');
        if (this.tagName === 'AUDIO' && window.__pcmProbe) { window.__pcmCapture = null; window.__pcmProbe.port.postMessage({ arm: true }); }
        const result = play.apply(this, args);
        result.then(() => record('play-resolved'), () => record('play-rejected'));
        return result;
      };
    }, filmEl);
    const page=await context.newPage(), errors=[], consoleErrors=[];page.on('pageerror',(e)=>errors.push(e.message));
    page.on('console',(message)=>{if(message.type()==='error') consoleErrors.push(message.text());});
    await page.goto(base,{waitUntil:'load'});await ready(page);
    // Existing crates API: save the actual opener before playback/offline reload.
    await page.evaluate(async () => {
      const {loadCrates}=await import('./crates.js'); const track=window.__skateNight.library.tracks.find((t)=>t.id==='praise-lifted-on-high');
      const r=await loadCrates([{url:new URL(track.file,location.href).href,kind:'audio'}]);if(r.failed.length) throw new Error('Opener crate preload failed');
    });
    if (hosted) {
      const cold=await filmSettled(page);
      results.push({label:`${width}x${height}-cold-start`,...cold});
      assert(cold.state==='ready' && /READY OFFLINE/.test(cold.text) && cold.text.includes(`SHA ${manifest.sha256.slice(0,8).toUpperCase()}`)
        && cold.text.includes('35.0 S') && cold.text.includes('1920x1080') && cold.text.includes('30 FPS'),`${width}x${height}: website film not prepared: ${cold.text}`);
    } else {
    await page.evaluate(()=>document.getElementById('cabinet-tools').open=true);
    await page.setInputFiles('#film-files',[proxy,manifestPath]);
    await page.waitForFunction(()=>!document.getElementById('btn-film-preview').disabled,null,{timeout:120000});
    }
    if(args.includes('--fault-only')) {
      results.push(await faultBeforeGate(page));
      results.push({label:'fault-diagnostics',pageErrors:errors,consoleErrors});
      assert(errors.length===0,'Fault fallback caused a page exception');
      await writeFile(resolve(out,'integration-proof.json'),JSON.stringify({generatedSyntheticProxy:!suppliedMovie,assetQuality:manifest.qualityTier || (suppliedMovie ? 'external-preview' : 'synthetic-technical-proxy'),cinematicApproval:false,movie:proxy,manifest:manifestPath,probe,results,failures},null,2)+'\n');
      await context.close();break;
    }
    // An imported audio audition must also be tested with the entire library saved.
    if (args.includes('--prepare-crates')) await prepareCrates(page);
    if (!offlineOnly) {
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
    }
    if(i===0 && (offlineOnly || !args.includes('--skip-offline'))) {
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;sessionStorage.removeItem('sn_opened');});
      if (hosted && !args.includes('--no-crates') && !args.includes('--prepare-crates')) await prepareCrates(page);
      await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
      await context.setOffline(true);
      for (let run = 0; run < offlineRuns; run++) {
        await page.evaluate(() => {
          sessionStorage.removeItem('sn_opened');
          localStorage.removeItem('sn-volumes');
        });
        await page.goto(hosted ? base : `${base}/?film=extended35`, { waitUntil: 'load' });
        await ready(page);
        if (hosted) {
          const offline=await filmSettled(page);
          offline.ledOfflineReady=await ledShows(page,'OFFLINE READY');
          assert(offline.state==='ready' && /SAVED FILM READY OFFLINE/.test(offline.text) && offline.ledOfflineReady,`offline reload not ready: ${JSON.stringify(offline)}`);
          results.push({label:`offline-reload-${run + 1}-status`,...offline});
        } else assert(await page.locator('#btn-film-preview').isEnabled(), 'OPFS preview not prepared on offline reload');
        const label = offlineRuns === 1 ? (hosted ? 'offline-opfs-reload-coin' : 'offline-opfs-reload-coin-opt-in') : `offline-opfs-run-${String(run + 1).padStart(2, '0')}`;
        results.push(await play(page, label, true));
        await page.evaluate(() => document.getElementById('btn-play').click());
        await page.waitForFunction(() => window.__skateNight.state().phase === 'paused');
        await page.evaluate(() => document.getElementById('btn-play').click());
        await page.waitForFunction(() => window.__skateNight.state().phase === 'playing' && window.__skateNight.player.isPlaying);
        await writeFile(resolve(out, 'integration-proof.json'), JSON.stringify({ generatedSyntheticProxy: !suppliedMovie,
          assetQuality: manifest.qualityTier, cinematicApproval: false, movie: proxy, manifest: manifestPath,
          offlineRunsRequested: offlineRuns, probe, results, failures }, null, 2) + '\n');
      }
      const prefix = hosted ? 'awakening-film-' : 'cinematic-preview-';
      if (hosted) {
        await page.evaluate(async(prefix)=>{
          const dir=await navigator.storage.getDirectory();
          for await(const [name,handle] of dir.entries()) if(name.startsWith(prefix) && name.endsWith('.mp4')) {
            const file=await handle.getFile();const w=await handle.createWritable();
            await w.write(new Uint8Array(await file.slice(0,file.size-4096).arrayBuffer()));await w.write(new Uint8Array(4096).fill(7));await w.close();
          }
          sessionStorage.removeItem('sn_opened');
        },prefix);
        await page.reload({waitUntil:'load'});await ready(page);
        const corrupt=await filmSettled(page);
        corrupt.ledWarns=await ledShows(page,'SONGS SAVED - FILM NOT READY');
        results.push({label:'offline-corrupt-film',...corrupt});
        assert(corrupt.state==='bad' && /NO VERIFIED FILM/.test(corrupt.text) && corrupt.ledWarns,`Corrupt saved film was not rejected with a warning: ${JSON.stringify(corrupt)}`);
      }
      const storage=await page.evaluate(async(prefix)=>{
        const dir=await navigator.storage.getDirectory();const names=[];for await(const [name] of dir.entries()) names.push(name);
        // A full-crates preview run can also have the approved production film.
        // Remove both in this disposable context to exercise the no-film fallback.
        for(const name of names) if(name.startsWith(prefix) || name.startsWith('awakening-film-')) await dir.removeEntry(name);
        sessionStorage.removeItem('sn_opened');return names;
      },prefix);
      await page.reload({waitUntil:'load'});await ready(page);
      if (hosted) {const missing=await filmSettled(page);results.push({label:'offline-missing-film-status',...missing});
        assert(missing.state==='bad' && /NO VERIFIED FILM/.test(missing.text),'Missing film did not warn');}
      else assert(await page.locator('#btn-film-preview').isDisabled(),'Missing preview was not rejected safely');
      await page.locator('#attract').click();
      await page.waitForFunction(()=>document.getElementById('attract').hidden && window.__skateNight.state().phase==='playing',null,{timeout:40000});
      const fallback=await page.evaluate(()=>({state:window.__skateNight.state(),
        usedLive:!window.__awakeningFilmStats && !window.__overlapStats,
        filmStopped:document.getElementById(window.__filmEl).paused,
        controlsReleased:!document.getElementById('btn-play').closest('[inert]')}));
      const fallbackPassed=fallback.usedLive && fallback.filmStopped && fallback.controlsReleased && fallback.state.nowId===cue.opener.track_id;
      assert(fallbackPassed,'Missing film failed to use the normal live cut and opener');
      await page.evaluate(()=>document.getElementById('btn-play').click());
      await page.waitForFunction(()=>window.__skateNight.state().phase==='paused');
      results.push({label:'offline-missing-film-fallback',passed:fallbackPassed,storedNames:storage,...fallback});
      await page.screenshot({path:resolve(out,'offline-live-fallback.png')});
      if (hosted) {
        // Back online with nothing saved: the launch check downloads and verifies the website film again.
        await context.setOffline(false);
        await page.evaluate(()=>sessionStorage.removeItem('sn_opened'));
        await page.reload({waitUntil:'load'});await ready(page);
        const recovered=await filmSettled(page);results.push({label:'online-recovery-download',...recovered});
        assert(recovered.state==='ready' && /WEBSITE FILM DOWNLOADED/.test(recovered.text),`Online recovery failed: ${recovered.text}`);
        // A website film that differs from the saved one is reported, never silently replaced or ignored.
        await page.route('**/films/manifest.json',(route)=>route.fulfill({contentType:'application/json',
          body:JSON.stringify({...hostedManifest,sha256:'0'.repeat(64)})}));
        await page.evaluate(()=>sessionStorage.removeItem('sn_opened'));
        await page.reload({waitUntil:'load'});await ready(page);
        const stale=await filmSettled(page);results.push({label:'stale-saved-film-warning',...stale});
        assert(stale.state==='bad' && /NOT THE CURRENT WEBSITE FILM/.test(stale.text),`Stale film not reported: ${stale.text}`);
        await page.unroute('**/films/manifest.json');
      }
    }
    results.push({label:`${width}x${height}-diagnostics`,pageErrors:errors,consoleErrors});
    assert(errors.length===0,`${width}x${height}: page errors ${errors.join('; ')}`);
    await writeFile(resolve(out,'integration-proof.json'),JSON.stringify({generatedSyntheticProxy:!suppliedMovie,assetQuality:manifest.qualityTier || (suppliedMovie ? 'external-preview' : 'synthetic-technical-proxy'),cinematicApproval:false,movie:proxy,manifest:manifestPath,probe,results,failures},null,2)+'\n');
    await context.close();
  }
} finally {await browser.close();await new Promise((done)=>server.close(done));}
if(failures.length) throw new Error(failures.join('\n'));
console.log(`PASSED selected native30 PWA checks: ${out}`);
