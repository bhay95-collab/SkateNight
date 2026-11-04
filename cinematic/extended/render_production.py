#!/usr/bin/env python3
"""Isolated native-30 production runner. No rendering occurs with --check.

A complete production render requires --render-full explicitly. Use --start / --end
for targeted work, or --width 480 --height 270 --samples 8 for the cheap animatic.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE.parent))
from frame_io import png_dimensions
from timeline import MANIFEST, MANIFEST_PATH, FRAME_COUNT, FPS, load_manifest


def atomic_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name('.'+path.name+f'.{os.getpid()}.pending')
    temp.write_text(json.dumps(value,indent=2)+'\n');os.replace(temp,path)


def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()


def assert_new_outputs(paths):
    for path in map(Path,paths):
        if path.exists() or path.is_symlink():
            raise FileExistsError(f'Existing output preserved: {path}. Choose a fresh versioned output directory.')


def publish_new_file(temporary,target):
    # link is atomic and fails if target appeared concurrently; replace would overwrite.
    os.link(temporary,target)
    Path(temporary).unlink()


def new_json(path,value):
    path=Path(path);assert_new_outputs([path]);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name('.'+path.name+f'.{os.getpid()}.pending')
    try:
        with temporary.open('x') as stream:stream.write(json.dumps(value,indent=2)+'\n')
        publish_new_file(temporary,path)
    finally:
        if temporary.exists():temporary.unlink()


def tracked_browser_assets():
    tracked=subprocess.run(['git','ls-files','-z'],cwd=ROOT,capture_output=True,check=True).stdout.decode().split('\0')
    return [Path(p) for p in tracked if Path(p).suffix.lower() in {'.jpg','.jpeg','.png','.webp','.svg','.woff','.woff2','.ttf'}
            and (len(Path(p).parts)==1 or Path(p).parts[0] in {'covers','fonts','icons'})]


def required_assets(assets_root):
    # kit.ROOT is assets_root; the cabinet server, independently, serves ROOT.
    assets_root=Path(assets_root)
    return list(dict.fromkeys([assets_root/p for p in ('rfai-logo.png','covers/vol-iv.jpg')]
                             +[ROOT/p for p in tracked_browser_assets()]))


def browser_dependencies():
    chrome=Path(os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    if not chrome.is_file() or not os.access(chrome,os.X_OK):
        raise FileNotFoundError(f'Chrome executable unavailable: {chrome}')
    override=os.environ.get('PLAYWRIGHT_CORE_PATH')
    if override and not Path(override).is_file():raise FileNotFoundError(f'Playwright override unavailable: {override}')
    script="""import {pathToFileURL} from 'node:url';
let location=process.env.PLAYWRIGHT_CORE_PATH;
if(!location){try{location=import.meta.resolve('playwright-core')}catch{location='/Users/benjaminhay/SkateNight/node_modules/playwright-core/index.mjs'}}
let url=location.startsWith('file:')?location:pathToFileURL(location).href;
const m=await import(url);if(typeof m.chromium?.launch!=='function')throw Error('Playwright chromium.launch unavailable');
console.log(JSON.stringify({playwright:url}));"""
    result=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Playwright import preflight failed: '+result.stderr)
    return {'chrome':str(chrome),**json.loads(result.stdout)}


def source_fingerprint(assets_root,settings,environment=None):
    """Content hashes, not mtimes: a stale render cannot silently be resumed."""
    assets_root=Path(assets_root)
    sources=sorted(p for p in (ROOT/'cinematic').rglob('*') if p.suffix in {'.py','.json','.mjs'})
    # Cabinet rendering imports the full app. Hash every tracked browser source,
    # stylesheet, font and vector too, including uncommitted content changes.
    tracked=subprocess.run(['git','ls-files','-z'],cwd=ROOT,capture_output=True,check=True).stdout.decode().split('\0')
    sources += [ROOT/p for p in tracked if Path(p).suffix.lower() in {'.js','.mjs','.html','.css','.svg','.woff','.woff2','.ttf'} and (ROOT/p).is_file()]
    assets=[assets_root/'build/awakening-film.mp4',assets_root/'build/cinematic-phase4/ui-plate.png',assets_root/'audio/praise-lifted-on-high.mp3']
    environment=os.environ if environment is None else environment
    assets += [Path(environment[name]) for name in ('SKATENIGHT_COIN_ENTRY_PLATE','SKATENIGHT_COIN_TEXTURE','SKATENIGHT_UI_PLATE') if environment.get(name) and Path(environment[name]).is_file()]
    assets += sorted(p for p in ROOT.rglob('*') if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.webp'} and 'build' not in p.parts and '.git' not in p.parts and 'node_modules' not in p.parts and '.playwright-mcp' not in p.parts)
    assets += required_assets(assets_root)
    for folder in ('covers','fonts'):
        assets += sorted(p for p in (assets_root/folder).rglob('*') if p.is_file())
    files={str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p):sha256(p) for p in sources+assets}
    payload={'schema':1,'settings':settings,'files':files}
    payload['sha256']=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return payload


def ensure_render_state(directory,fingerprint,resume,state_name='render-state.json',frame_range=None):
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    state=directory/state_name
    frames=list(directory.glob('frame_*.png'))
    if frame_range is not None:
        lo,hi=frame_range
        frames=[p for p in frames if lo <= int(p.stem.split('_')[-1]) <= hi]
    if state.exists():
        previous=json.loads(state.read_text())
        if previous.get('sha256')!=fingerprint['sha256']:
            raise RuntimeError(f'Stale render fingerprint: {directory}. Choose a new output directory; existing frames are preserved.')
        if frames and not resume:
            raise FileExistsError(f'Frames already exist in {directory}; use --resume to validate and recover them.')
    elif frames:
        raise RuntimeError(f'Unfingerprinted frames in {directory}; refusing to adopt them. Choose a new output directory.')
    else:
        atomic_json(state,fingerprint)
    return state


def run_logged(command,logs,name,env=None):
    logs=Path(logs);logs.mkdir(parents=True,exist_ok=True)
    stamp=time.strftime('%Y%m%d-%H%M%S')
    logfile=logs/f'{stamp}-{name}-{time.time_ns()}.log'
    print('RUN', ' '.join(map(str,command)),flush=True)
    with logfile.open('w') as log:
        log.write(json.dumps({'command':list(map(str,command)),'start_utc':time.time()},indent=2)+'\n');log.flush()
        result=subprocess.run(list(map(str,command)),stdout=log,stderr=subprocess.STDOUT,env=env)
    if result.returncode:
        raise RuntimeError(f'{name} failed ({result.returncode}); persistent log: {logfile}')
    print(f'LOG {logfile}',flush=True)


def preflight(assets_root,output,width=1920,height=1080,metal=True):
    load_manifest()  # Re-read even in a long-lived process before touching tools.
    tools={name:shutil.which(name) for name in ('blender','ffmpeg','ffprobe','node')}
    if not all(tools.values()): raise RuntimeError(f'Missing dependency: {tools}')
    browser=browser_dependencies()  # import only; never launches Chrome or touches the GPU
    for rel in ('build/awakening-film.mp4','build/cinematic-phase4/ui-plate.png','audio/praise-lifted-on-high.mp3'):
        if not (assets_root/rel).is_file(): raise FileNotFoundError(assets_root/rel)
    textures=required_assets(assets_root)
    for texture in textures:
        if not texture.is_file() or texture.stat().st_size==0:raise FileNotFoundError(f'Required texture/font unavailable: {texture}')
    if png_dimensions(assets_root/'rfai-logo.png') is None:raise RuntimeError('Robot texture is not a valid PNG')
    if not (assets_root/'covers/vol-iv.jpg').read_bytes().startswith(b'\xff\xd8'):
        raise RuntimeError('Active-record label is not a JPEG')
    if png_dimensions(assets_root/'build/cinematic-phase4/ui-plate.png')!=(1920,1080):
        raise RuntimeError('Source UI plate is not a valid 1920x1080 PNG')
    info=json.loads(subprocess.run([tools['ffprobe'],'-v','error','-show_streams','-of','json',str(assets_root/'build/awakening-film.mp4')],capture_output=True,text=True,check=True).stdout)
    v=next((s for s in info['streams'] if s['codec_type']=='video'),{})
    if v.get('width')!=1920 or v.get('height')!=1080 or v.get('r_frame_rate')!='60/1' or not any(s['codec_type']=='audio' for s in info['streams']):
        raise RuntimeError('Approved coin source must retain 1920x1080/60 video plus audio')
    encoders=subprocess.run([tools['ffmpeg'],'-hide_banner','-encoders'],capture_output=True,text=True,check=True).stdout
    if 'libx264' not in encoders or ' aac ' not in encoders: raise RuntimeError('FFmpeg requires libx264 and AAC encoders')
    target=output
    while not target.exists():target=target.parent
    free=shutil.disk_usage(target).free
    # Lossless frames plus scratch and output; conservative storage budget scales by pixels.
    required=max(4*1024**3,int(width*height*FRAME_COUNT*5*1.35))
    if free<required: raise RuntimeError(f'Insufficient storage: {free/1024**3:.1f} GiB free; {required/1024**3:.1f} GiB required')
    report={'tools':tools,'browser':browser,'required_textures':list(map(str,textures)),'free_gib':free/1024**3,'required_gib':required/1024**3,'source_video':v,'metal_checked':metal}
    if metal:
        expr="import bpy; p=bpy.context.preferences.addons['cycles'].preferences; p.get_devices(); d=[d.name for d in p.devices if d.type=='METAL']; print('METAL_DEVICES='+repr(d)); raise SystemExit(0 if d else 2)"
        result=subprocess.run([tools['blender'],'-b','--python-expr',expr],capture_output=True,text=True)
        if result.returncode: raise RuntimeError('Cycles Metal unavailable:\n'+result.stdout+result.stderr)
        report['metal']=result.stdout
    return report


def validate_frames(directory,start,end,width,height):
    invalid=[f for f in range(start,end+1) if png_dimensions(Path(directory)/f'frame_{f:04d}.png')!=(width,height)]
    if invalid: raise RuntimeError(f'Missing/corrupt frames in {directory}: {invalid[:20]} ({len(invalid)} total)')


def prepare_native_assets(output,assets_root,resume,logs):
    native=output/'assets/native-cabinet'
    settings={'width':1920,'height':1080,'renderer':'native-browser-30','fps':FPS}
    ensure_render_state(native,source_fingerprint(assets_root,settings),resume)
    command=['node',HERE/'render_cabinet.mjs','--start','0','--end','92','--width','1920','--height','1080','--output-dir',native,'--assets-root',assets_root]
    if resume:command.append('--resume')
    run_logged(command,logs,'native-cabinet')
    validate_frames(native,0,92,1920,1080)
    transition=output/'assets/transition';transition.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.transition-',dir=transition) as temp:
        temp=Path(temp)
        shutil.copy2(native/'frame_0092.png',temp/'entry-plate.png')
        run_logged(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',native/'frame_0045.png','-vf','crop=144:144:872:476','-frames:v','1',temp/'coin-face.png'],logs,'coin-texture')
        for name in ('entry-plate.png','coin-face.png'):
            target=transition/name
            if target.exists():
                if sha256(target)!=sha256(temp/name):raise RuntimeError(f'Existing transition asset is different and preserved: {target}')
            else:publish_new_file(temp/name,target)
    if png_dimensions(transition/'coin-face.png')!=(144,144):raise RuntimeError('Invalid native coin texture')
    return native,transition


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--assets-root',type=Path,default=ROOT)
    p.add_argument('--output-dir',type=Path,default=ROOT/'build/awakening-35-production/v1')
    p.add_argument('--width',type=int,default=1920);p.add_argument('--height',type=int,default=1080)
    p.add_argument('--samples',type=int,help='Override all shots; defaults preserve story128 and changer/vinyl96')
    p.add_argument('--engine',choices=('cycles','eevee'),default='cycles')
    p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=FRAME_COUNT-1)
    p.add_argument('--resume',action='store_true');p.add_argument('--check',action='store_true')
    p.add_argument('--skip-metal-check',action='store_true',help='CPU assembly/preflight only; no GPU render allowed')
    p.add_argument('--render-full',action='store_true',help='Explicitly authorize expensive full-resolution complete film')
    p.add_argument('--assemble-only',action='store_true');p.add_argument('--audio-only',action='store_true')
    p.add_argument('--importable-proxy',action='store_true',help='Also write a spatial-only 1080p development proxy for application testing')
    p.add_argument('--export-root',type=Path,help='Fresh assembly export version; existing media are preserved')
    a=p.parse_args();a.assets_root=a.assets_root.resolve();a.output_dir=a.output_dir.resolve()
    if a.width<=0 or a.height<=0 or a.width%2 or a.height%2 or a.width*9!=a.height*16 or (a.samples is not None and a.samples<1) or not 0<=a.start<=a.end<FRAME_COUNT:raise ValueError('Invalid 16:9 dimensions, samples or frame range')
    report=preflight(a.assets_root,a.output_dir,a.width,a.height,not a.skip_metal_check)
    atomic_json(a.output_dir/'preflight.json',report)
    if a.check:print(json.dumps(report,indent=2));return
    logs=a.output_dir/'logs'
    if not a.assemble_only:
        from audio import build
        build(a.output_dir/'audio',a.assets_root,resume=a.resume)
    if a.audio_only:return
    if not a.assemble_only:
        if a.width>=1920 and a.start==0 and a.end==FRAME_COUNT-1 and not a.render_full:
            raise RuntimeError('Complete 1080p film requires explicit --render-full. Use --check or targeted --start/--end.')
        if a.skip_metal_check:raise RuntimeError('Remove --skip-metal-check before rendering')
        native,transition=prepare_native_assets(a.output_dir,a.assets_root,a.resume,logs)
        env=os.environ.copy();env.update({'SKATENIGHT_COIN_ENTRY_PLATE':str(transition/'entry-plate.png'),'SKATENIGHT_COIN_TEXTURE':str(transition/'coin-face.png'),'SKATENIGHT_CINEMATIC_OUT':str(a.output_dir/'renderer')})
        for shot in MANIFEST['shots']:
            start=max(a.start,shot['start']);end=min(a.end,shot['end'])
            if start>end:continue
            directory=a.output_dir/'frames'/shot['id']
            samples=a.samples if a.samples is not None else (128 if shot['id']=='story' else 96)
            settings={'width':a.width,'height':a.height,'samples':samples,'engine':a.engine,'shot':shot['id'],'fps':FPS}
            ensure_render_state(directory,source_fingerprint(a.assets_root,settings,env),a.resume)
            if shot['id']=='cabinet':
                directory.mkdir(parents=True,exist_ok=True)
                for f in range(start,end+1):
                    dest=directory/f'frame_{f:04d}.png'
                    if a.resume and png_dimensions(dest)==(a.width,a.height):continue
                    temp=dest.with_name('.'+dest.name)
                    run_logged(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',native/f'frame_{f:04d}.png','-vf',f'scale={a.width}:{a.height}:flags=lanczos','-frames:v','1',temp],logs,f'cabinet-{f}')
                    if png_dimensions(temp)!=(a.width,a.height):raise RuntimeError(f'Invalid cabinet frame{f}')
                    os.replace(temp,dest)
            else:
                command=['blender','-b','--python-exit-code','1','--python',HERE/'render_scene.py','--','--shot',shot['id'],'--start',start,'--end',end,'--width',a.width,'--height',a.height,'--samples',samples,'--engine',a.engine,'--output-dir',directory,'--assets-root',a.assets_root]
                if a.render_full:command.append('--production-render')
                if a.resume:command.append('--resume')
                run_logged(command,logs,shot['id'],env)
            validate_frames(directory,start,end,a.width,a.height)
        if a.start or a.end!=FRAME_COUNT-1:
            print('Targeted render complete; complete-film assembly intentionally skipped');return
    command=[sys.executable,HERE/'assemble.py','--render-root',a.output_dir,'--width',a.width,'--height',a.height]
    if a.importable_proxy:command.append('--importable-proxy')
    if a.export_root:command.extend(['--export-root',a.export_root.resolve()])
    run_logged(command,logs,'assemble')


if __name__=='__main__':main()
