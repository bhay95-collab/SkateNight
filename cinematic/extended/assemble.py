#!/usr/bin/env python3
"""Assemble exactly 1050 native-30 frames; effects and song review stay separate.

Existing exports are never overwritten. To recover an interrupted export while
retaining its files, use --export-root NEW_VERSION_DIR with the same render-root.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from timeline import AUDIO,CUES,DURATION,FPS,FRAME_COUNT,FRAMES,MANIFEST,manifest_sha256,shot_for_frame
_spec=importlib.util.spec_from_file_location('extended_production_pipeline',HERE/'render_production.py')
_pipeline=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pipeline)
atomic_json,sha256,validate_frames=_pipeline.atomic_json,_pipeline.sha256,_pipeline.validate_frames
assert_new_outputs,new_json,publish_new_file=_pipeline.assert_new_outputs,_pipeline.new_json,_pipeline.publish_new_file
_audio_spec=importlib.util.spec_from_file_location('extended_audio_provenance',HERE/'audio.py')
_audio=importlib.util.module_from_spec(_audio_spec);_audio_spec.loader.exec_module(_audio)


def validate_render_provenance(render_root,width,height,synthetic_fixture=False):
    """Verify recorded content hashes at assembly time, even without rendering."""
    checked={}
    proofs=[]
    for shot in MANIFEST['shots']:
        directory=Path(render_root)/'frames'/shot['id']
        candidates=[directory/'render-state.json',directory/f"render-state-{shot['id']}.json"]
        path=next((p for p in candidates if p.is_file()),None)
        if path is None:raise RuntimeError(f'Missing render fingerprint for {shot["id"]}: {directory}')
        proof=json.loads(path.read_text())
        digest=proof.get('sha256');payload={k:v for k,v in proof.items() if k!='sha256'}
        actual=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        settings=proof.get('settings',{})
        if (digest!=actual or not proof.get('files') or proof.get('schema')!=1
            or settings.get('width')!=width or settings.get('height')!=height
            or settings.get('fps')!=FPS or settings.get('shot')!=shot['id']
            or (proof.get('synthetic_fixture') and not synthetic_fixture)):
            raise RuntimeError(f'Invalid render fingerprint/settings for {shot["id"]}: {path}')
        for source,expected in proof['files'].items():
            source_path=Path(source) if Path(source).is_absolute() else _pipeline.ROOT/source
            if source_path not in checked:
                checked[source_path]=sha256(source_path) if source_path.is_file() else None
            if checked[source_path]!=expected:
                raise RuntimeError(f'Stale render source/asset for {shot["id"]}: {source_path}. Render fresh frames before assembly.')
        proofs.append({'shot':shot['id'],'fingerprint_sha256':digest,'state_file':str(path)})
    return proofs


def probe(path):
    return json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)


def verify_movie(path,width,height):
    info=probe(path)
    v=next((s for s in info['streams'] if s['codec_type']=='video'),{})
    a=next((s for s in info['streams'] if s['codec_type']=='audio'),{})
    if (v.get('codec_name')!='h264' or v.get('width')!=width or v.get('height')!=height
        or v.get('r_frame_rate')!='30/1' or int(v.get('nb_frames',0))!=FRAME_COUNT
        or abs(float(v.get('duration',0))-DURATION)>1e-6
        or a.get('codec_name')!='aac' or a.get('sample_rate')!='48000' or a.get('channels')!=2
        or abs(float(a.get('duration',0))-DURATION)>1/FPS):
        raise RuntimeError('Movie verification failed: '+json.dumps(info))
    return info


def validate_audio(path):
    with wave.open(str(path),'rb') as w:
        if (w.getframerate(),w.getnchannels(),w.getsampwidth(),w.getnframes())!=(48000,2,2,1680000):
            raise ValueError(f'Audio must be exact 35-second 48k stereo PCM16: {path}')


def validate_audio_provenance(directory,synthetic_fixture=False):
    directory=Path(directory)
    report=json.loads((directory/'audio-report.json').read_text())
    if not (synthetic_fixture and report.get('synthetic_fixture') is True):
        _audio.validate_report(report,directory)
    if (report.get('manifest_sha256')!=manifest_sha256() or report.get('effects_only') is not True
        or report.get('effects_sha256')!=sha256(directory/'effects-only.wav')
        or report.get('review_sha256')!=sha256(directory/'review-with-song.wav')):
        raise RuntimeError('Audio provenance is stale or mismatched; rebuild extended/audio.py before assembly')


def film_manifest(movie,width,height,version=1):
    handoff_frame=math.floor(AUDIO['songPlayback']*FPS)
    result={
      'manifestVersion':1,'filmKind':'production-preview','filmId':MANIFEST['version'],'filmVersion':version,
      'experimental':True,'title':'Skate by Faith — The Song Inside (35-second production development)',
      'source':'Isolated native-30 browser and Blender development render; unapproved local preview',
      'videoFile':Path(movie).name,'width':width,'height':height,'fps':FPS,'frameCount':FRAME_COUNT,'durationSec':DURATION,
      'videoCodec':'h264','audioCodec':'aac','audioSampleRate':48000,'audioChannels':2,
      'audioDescription':'cinematic sound effects only; opening song remains in the jukebox player',
      'audioOwnership':{'film':'cinematic sound effects and atmosphere','openingSong':'Praise Lifted On High remains in the jukebox audio engine','trackId':MANIFEST['opener']['track_id'],'songEmbedded':False},
      'cues':{'coinSequenceStartFrame':0,'firstFailureFrame':FRAMES['failure'],'recoveryFrame':FRAMES['catch'],
              'stylusContactFrame':FRAMES['stylusContact'],'musicHandoffFrame':handoff_frame,'firstSongCueFrame':FRAMES['stylusContact'],
              'registrationStartFrame':FRAMES['registrationStart'],'finalCinematicFrame':FRAME_COUNT-1},
      'handoff':{'mode':'overlap','videoFrame':handoff_frame,'openerTrackId':MANIFEST['opener']['track_id'],
                 'interactiveState':'jukebox-playing:praise-lifted-on-high','songStartSec':AUDIO['songPlayback'],'record':MANIFEST['c1']['record']},
      'timelineSha256':manifest_sha256(),'sha256':sha256(movie),
      'applicationImportable':width==1920 and height==1080,
    }
    return result


def encode(sequence,audio,output,width,height):
    assert_new_outputs([output])
    temporary=output.with_name('.'+output.stem+f'.{os.getpid()}.pending.mp4')
    try:
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),'-start_number','0','-i',str(sequence/'frame_%04d.png'),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-frames:v',str(FRAME_COUNT),'-t',str(DURATION),'-c:v','libx264','-preset','medium','-crf','18','-profile:v','high','-level:v','4.2','-pix_fmt','yuv420p','-r',str(FPS),'-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-movflags','+faststart',str(temporary)],check=True)
        verify_movie(temporary,width,height)
        publish_new_file(temporary,output)
    finally:
        if temporary.exists():temporary.unlink()


def package_proxy(movie,output,version=1):
    """Spatial enlargement only: every native frame retains its time and index."""
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    target=output/'awakening-35-1080-DEVELOPMENT-PROXY.mp4'
    assert_new_outputs([target,target.with_suffix('.mp4.json')])
    source_manifest=json.loads(Path(movie).with_suffix('.mp4.json').read_text())
    if (source_manifest.get('sha256')!=sha256(movie)
        or source_manifest.get('audioOwnership',{}).get('songEmbedded') is not False
        or source_manifest.get('timelineSha256')!=manifest_sha256()):
        raise RuntimeError('Only a verified current effects-only development export can become an integration proxy')
    source_info=probe(movie)
    source_video=next(s for s in source_info['streams'] if s['codec_type']=='video')
    verify_movie(movie,source_video['width'],source_video['height'])
    temporary=target.with_name('.'+target.stem+f'.{os.getpid()}.pending.mp4')
    try:
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(movie),'-map','0:v:0','-map','0:a:0',
                        '-vf','scale=1920:1080:flags=lanczos','-fps_mode','passthrough','-frames:v',str(FRAME_COUNT),
                        '-c:v','libx264','-preset','fast','-crf','20','-profile:v','high','-level:v','4.2',
                        '-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(temporary)],check=True)
        verify_movie(temporary,1920,1080)
        publish_new_file(temporary,target)
    finally:
        if temporary.exists():temporary.unlink()
    manifest=film_manifest(target,1920,1080,version)
    manifest.update(title='The Song Inside — development proxy for application integration',
                    source='Spatial upscale of the native-30 development animatic; not final 1080p render quality',
                    qualityTier='development-proxy',
                    proxySource={'file':Path(movie).name,'sha256':sha256(movie),
                                 'width':source_video['width'],'height':source_video['height'],
                                 'frameMapping':'one source frame per output frame; no temporal conversion'})
    manifest['renderProvenance']=source_manifest.get('renderProvenance',[])
    new_json(target.with_suffix('.mp4.json'),manifest)
    return manifest


def assemble(render_root,width,height,version=1,importable_proxy=False,synthetic_fixture=False,export_root=None):
    render_root=Path(render_root)
    export_root=Path(export_root) if export_root is not None else render_root
    output=export_root/'assembled'
    movie=output/'awakening-35-effects-only.mp4'
    review_movie=output/'awakening-35-REVIEW-WITH-SONG.mp4'
    planned=[movie,movie.with_suffix('.mp4.json'),review_movie,output/'assembly-report.json']
    if importable_proxy:
        proxy=export_root/'technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4'
        planned += [proxy,proxy.with_suffix('.mp4.json')]
    assert_new_outputs(planned)
    proofs=validate_render_provenance(render_root,width,height,synthetic_fixture)
    for shot in MANIFEST['shots']:
        validate_frames(render_root/'frames'/shot['id'],shot['start'],shot['end'],width,height)
    effects=render_root/'audio/effects-only.wav';review=render_root/'audio/review-with-song.wav'
    validate_audio(effects);validate_audio(review)
    validate_audio_provenance(render_root/'audio',synthetic_fixture)
    output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.assembly-',dir=output) as temp:
        sequence=Path(temp)
        for f in range(FRAME_COUNT):
            (sequence/f'frame_{f:04d}.png').symlink_to((render_root/'frames'/shot_for_frame(f)/f'frame_{f:04d}.png').resolve())
        encode(sequence,effects,movie,width,height)
        manifest=film_manifest(movie,width,height,version)
        manifest['renderProvenance']=proofs
        new_json(movie.with_suffix('.mp4.json'),manifest)
        # Review output deliberately has no importable cinematic manifest.
        encode(sequence,review,review_movie,width,height)
        new_json(output/'assembly-report.json',{'frame_count':FRAME_COUNT,'fps':FPS,'duration_seconds':DURATION,'width':width,'height':height,'effects_movie':str(movie),'effects_sha256':manifest['sha256'],'review_movie':str(review_movie),'review_song_embedded':True,'review_sha256':sha256(review_movie),'timeline_sha256':manifest_sha256(),'application_importable':manifest['applicationImportable'],'render_provenance':proofs,'synthetic_fixture':synthetic_fixture})
    if importable_proxy:
        package_proxy(movie,export_root/'technical-integration',version)
    print(f'ASSEMBLED {FRAME_COUNT} original native30 frames; effects-only manifest: {movie}.json')
    return manifest


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--render-root',type=Path,required=True);p.add_argument('--width',type=int,default=1920);p.add_argument('--height',type=int,default=1080);p.add_argument('--version',type=int,default=1)
    p.add_argument('--importable-proxy',action='store_true',help='Write clearly labeled spatial-only 1080p development proxy in technical-integration')
    p.add_argument('--export-root',type=Path,help='Fresh export version directory; reuse verified frames/audio from render-root')
    a=p.parse_args();assemble(a.render_root,a.width,a.height,a.version,a.importable_proxy,export_root=a.export_root)
