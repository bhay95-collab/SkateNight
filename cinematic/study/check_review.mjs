import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/benjaminhay/SkateNight/node_modules/playwright-core/index.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(root, 'build/awakening-30fps-study/v1');
const source = '/Users/benjaminhay/SkateNight';
const phase = JSON.parse(await readFile(`${out}/landing-cycles/render.json`)).finalCssAngleDeg;
const css = await readFile(resolve(root, 'changer.css'), 'utf8');
await writeFile(`${out}/ui-plate.png`, await readFile(`${source}/build/cinematic-phase4/ui-plate.png`));
await writeFile(`${out}/cover-vol-iv.jpg`, await readFile(`${source}/covers/vol-iv.jpg`));
const harness = `<!doctype html><html><meta charset="utf-8"><style>${css}
body{margin:0;background:#000;width:1920px;height:1080px;overflow:hidden}
#ui{position:absolute;width:1920px;height:1080px;inset:0}
#holder{position:absolute;left:1067.5px;top:330.9px;width:181px;height:181px;visibility:hidden;font-size:16px}
#film{position:absolute;inset:0;width:1920px;height:1080px}
#note{position:absolute;left:20px;bottom:20px;background:#000c;color:white;padding:8px;font:18px system-ui}
</style><img id="ui" src="ui-plate.png"><div id="holder"><div class="record is-spinning" id="record"><div class="record-label" style="background-image:url('cover-vol-iv.jpg')"></div><div class="record-hole"></div></div></div>
<video id="film" muted playsinline src="landing-cycles.mp4"></video><button id="begin" style="position:absolute;left:20px;top:20px;padding:14px">Play handoff</button><div id="note">DIAGNOSTIC: native 30 fps film → actual 45 rpm CSS record. Static UI plate. PWA integration not enabled.</div>
<script>
const v=document.querySelector('#film'),spin=document.querySelector('#record').getAnimations().find(a=>a.animationName==='record-spin');
window.frames=[];window.refresh=[];window.live=[];
function frame(now,m){window.frames.push({now,media:m.mediaTime});const u=Math.max(0,Math.min(1,(v.currentTime-2.666666667)/.7));
v.style.maskImage='radial-gradient(circle at 60.3125% 39.0185%,#000 90.5px,rgba(0,0,0,'+(1-u)+') 98px)';
if(!v.ended)v.requestVideoFrameCallback(frame);}
v.requestVideoFrameCallback(frame);
v.onended=()=>{spin.currentTime=${phase}/360*(60000/45);window.boundaryPhaseMs=spin.currentTime;document.querySelector('#holder').style.visibility='visible';v.style.display='none';window.endedAt=performance.now();};
function tick(now){window.refresh.push(now);if(window.endedAt)window.live.push({now,spin:spin.currentTime});if(!window.done)requestAnimationFrame(tick)}requestAnimationFrame(tick);
window.start=()=>{document.querySelector('#begin').hidden=true;return v.play();};document.querySelector('#begin').onclick=window.start;
</script></html>`;
await writeFile(`${out}/handoff-diagnostic.html`, harness);

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let path=resolve(root, '.'+decodeURIComponent(url.pathname));
    if(url.pathname==='/source-ui.png')path=`${source}/build/cinematic-phase4/ui-plate.png`;
    else if(url.pathname==='/source-cover.jpg')path=`${source}/covers/vol-iv.jpg`;
    else if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const data=await readFile(path);
    res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','content-length':data.length});res.end(data);
  } catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/build/awakening-30fps-study/v1/index.html`);
  await page.locator('video').first().evaluate(v=>{v.preload='auto';v.load();});
  await page.waitForFunction(()=>document.querySelector('video').readyState>=4);
  await page.locator('video').first().evaluate(v=>{v.muted=true;return v.play();});
  await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:45000});
  const playback=await page.locator('video').first().evaluate(v=>({duration:v.duration,time:v.currentTime,...v.getVideoPlaybackQuality().toJSON?.(),totalFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedFrames:v.getVideoPlaybackQuality().droppedVideoFrames}));
  await page.screenshot({path:`${out}/review-browser.png`});
  await page.goto(`${base}/build/awakening-30fps-study/v1/handoff-diagnostic.html`);
  await page.evaluate(()=>window.start());
  await page.waitForFunction(()=>window.endedAt&&performance.now()-window.endedAt>1100,null,{timeout:15000});
  await page.screenshot({path:`${out}/handoff-browser.png`});
  const handoff=await page.evaluate(()=>{window.done=true;return {frames:window.frames,refresh:window.refresh,live:window.live,boundaryPhaseMs:window.boundaryPhaseMs,endedAt:window.endedAt,quality:{total:film.getVideoPlaybackQuality().totalVideoFrames,dropped:film.getVideoPlaybackQuality().droppedVideoFrames}};});
  const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const steady=handoff.live.filter(x=>x.now-handoff.endedAt>100);
  const report={playback,errors,expectedPhaseDeg:phase,boundaryPhaseDeg:handoff.boundaryPhaseMs/(60000/45)*360,
    filmMedianPresentationMs:median(handoff.frames.slice(1).map((x,i)=>x.now-handoff.frames[i].now)),
    displayMedianRefreshMs:median(handoff.refresh.slice(1).map((x,i)=>x-handoff.refresh[i])),
    cssStartDelayMs:handoff.live.find(x=>x.spin>handoff.boundaryPhaseMs).now-handoff.endedAt,
    liveMeasuredDegreesPerSecond:(steady.at(-1).spin-steady[0].spin)/(steady.at(-1).now-steady[0].now)*360/(60000/45)*1000,
    quality:handoff.quality,limits:'Isolated fixed-1920x1080 static-plate diagnostic using actual changer.css. No live song engine or production manifest bypass. Headless Chrome is not event-display acceptance.',raw:handoff};
  await writeFile(`${out}/browser-playback.json`,JSON.stringify(report,null,2));
  if(errors.length||Math.abs(report.boundaryPhaseDeg-phase)>.01||Math.abs(report.liveMeasuredDegreesPerSecond-270)>2)throw new Error('Browser cadence/phase check failed');
  console.log(JSON.stringify({...report,raw:undefined},null,2));
} finally {await browser.close();server.close();}
