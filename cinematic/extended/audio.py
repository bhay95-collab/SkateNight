#!/usr/bin/env python3
"""Reproducible effects-only master and a separate song-embedded review mix.

No song samples are used by compose(). The approved coin source contributes
only the first 3.1 seconds, before this film's new interior begins.
"""
import argparse
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import sound_bed as voices
from timeline import AUDIO, CUES, DURATION, MANIFEST, manifest_sha256

RATE = 48000


def digest(path):
    value=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):value.update(block)
    return value.hexdigest()


def dependency_hashes(assets_root):
    assets_root=Path(assets_root).resolve()
    paths=[HERE/'audio.py',Path(voices.__file__).resolve(),HERE/'timeline.py',HERE/'cues.json',
           HERE.parent/'cues.json',assets_root/'build/awakening-film.mp4',
           assets_root/'audio'/f"{MANIFEST['opener']['track_id']}.mp3"]
    return {str(p.resolve()):digest(p) for p in paths}


def validate_report(report,directory,review=True):
    directory=Path(directory)
    if not isinstance(report.get('assets_root'),str):raise RuntimeError('Audio report lacks source dependency provenance')
    if (report.get('manifest_sha256')!=manifest_sha256() or report.get('effects_only') is not True
        or report.get('dependency_hashes')!=dependency_hashes(report['assets_root'])
        or report.get('effects_sha256')!=digest(directory/'effects-only.wav')
        or (review and report.get('review_sha256')!=digest(directory/'review-with-song.wav'))):
        raise RuntimeError('Audio source dependencies or output hashes are stale; choose a fresh audio output directory')


def publish_new(temporary,target):
    os.link(temporary,target)
    Path(temporary).unlink()


def envelope(t, start, end, attack=0.25, release=0.4):
    return max(0.0, min(1.0, (t-start)/attack, (end-t)/release))


def motor(start, end, level, accelerate=True):
    phase = 0.0
    result = []
    for i in range(round((end-start)*RATE)):
        t = i/RATE
        u = t/(end-start)
        phase += math.tau * (65 + (230*u if accelerate else 75))/RATE
        body = .48*math.sin(phase)+.16*math.sin(phase*2.003)
        teeth = .22*math.sin(phase*7.07) * (.65+.35*math.sin(math.tau*3.3*t))
        result.append(level*(body+teeth)*envelope(t,0,end-start))
    return result


def compose():
    voices.RNG = random.Random(351050)  # every invocation, including repeated imports
    m = voices.Mix(DURATION)
    impact = AUDIO['coinImpact']
    entry = CUES['coinGone']
    for i, dt in enumerate((.02,.16,.37,.65,1.04)):
        m.add(entry+dt, voices.ring([(1420-i*90,.65),(2710-i*140,.24)],.22,.055), .12, (-1)**i*.35)
    m.add(impact,voices.thump(64,.75,.11,.35),.43)
    m.add(impact+.012,voices.ring([(117,.7),(239,.4),(491,.18)],1.8,.45),.23)
    relay,fail=CUES['relay'],CUES['failure']
    m.add(relay,voices.thump(48,.45,.09,.3),.38)
    m.add(relay,motor(relay,fail,.22))
    m.add(fail,voices.wind_down(.31),.28)
    # A deliberate near-silent interval ends at the isolated robot tick.
    m.add(CUES['tick'],voices.ring([(2650,.6),(5090,.25)],.09,.016),.36,.25)
    m.add(CUES['catch'],voices.thump(42,.5,.1,.2),.35)
    for i,t in enumerate(CUES['heartbeats']):
        gain=.19+i*.045
        m.add(t,voices.thump(51,.29,.065,.1),gain)
        m.add(t+.085,voices.thump(63,.20,.048,.04),gain*.5)
    ignite=CUES['ignite']
    m.add(ignite,voices.thump(37,.9,.18,.35),.44)
    m.add(ignite,motor(ignite,CUES['activeRecord'],.14))
    m.add(CUES['transmission'],voices.ring([(121,.6),(277,.3),(618,.2)],1.3,.28),.22,-.2)
    for i in range(9):
        t=CUES['carousel']+i*.395
        m.add(t,voices.thump(85, .22,.045,.18),.07,.4*math.sin(i))
        m.add(t,voices.ring([(391,.3),(812,.13)],.26,.035),.1,-.25)
    # The hidden world is the unplayed record's surface: inharmonic resonances,
    # modulated tooth movement and low filtered texture, never the opening song.
    start,end=CUES['grooveDescent'],CUES['stylusApproach']
    n=round((end-start)*RATE)
    resonance=[]
    for i in range(n):
        t=i/RATE
        env=envelope(t,0,end-start,.7,1.1)
        pressure=.55+.18*math.sin(math.tau*.73*t)
        v=(.065*math.sin(math.tau*47.3*t)+.034*math.sin(math.tau*113.7*t)
           +.017*math.sin(math.tau*229.1*t)*(1+math.sin(math.tau*2.15*t))*.5)
        resonance.append(env*pressure*v)
    m.add(start,resonance,.8,-.15)
    m.add(start,voices.noise(end-start,320,lambda t:.24*envelope(t,0,end-start,.8,1)),.14,.22)
    for t,pan in ((22.8,-.7),(24.8,.55),(26.4,-.4)):
        m.add(t,voices.ring([(176,.45),(403,.17),(977,.06)],.75,.2),.055,pan)
    m.add(CUES['grooveExit'],voices.noise(2.8,850,lambda t:.22*math.sin(math.pi*t/2.8)**2),.12,-.3)
    contact=CUES['stylusContact']
    m.add(contact-.29,voices.noise(.29,1700,lambda t:(t/.29)**2),.033)
    m.add(contact,voices.thump(89,.18,.032,.045,(1,.14)),.10)
    m.add(contact,voices.crackle(.9,11,.06),.18)
    # Preserve tactile contact while yielding all musical space to the live song.
    for i in range(round(contact*RATE),m.n):
        gain=max(0,1-(i/RATE-contact)/1.0)
        m.l[i]*=gain
        m.r[i]*=gain
    return m


def add_opening(m, source):
    with tempfile.TemporaryDirectory() as temp:
        path=Path(temp)/'coin.wav'
        subprocess.run([shutil.which('ffmpeg') or 'ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-t',str(CUES['coinGone']),'-vn','-ar',str(RATE),'-ac','2','-c:a','pcm_s16le',str(path)],check=True)
        import array
        with wave.open(str(path),'rb') as w:
            samples=array.array('h',w.readframes(w.getnframes()))
        if sys.byteorder!='little': samples.byteswap()
        for i in range(len(samples)//2):
            gain=min(1,(CUES['coinGone']-i/RATE)/.025)
            m.l[i]+=samples[2*i]/32768*gain
            m.r[i]+=samples[2*i+1]/32768*gain


def loudness(path):
    result=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,check=True)
    summary=result.stderr.rsplit('Summary:',1)[-1]
    values={}
    for key,pattern in [('integrated_lufs',r'I:\s*(-?[\d.]+) LUFS'),('loudness_range_lu',r'LRA:\s*([\d.]+) LU'),('true_peak_dbfs',r'Peak:\s*(-?[\d.]+) dBFS')]:
        match=re.search(pattern,summary)
        if match: values[key]=float(match.group(1))
    return values


def write_review(effects,song,output):
    delay=round(AUDIO['songPlayback']*RATE)
    graph=(f'[1:a]aresample={RATE},adelay={delay}S:all=1,apad,atrim=end={DURATION}[song];'
           f'[0:a][song]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.97:level=false:latency=true,atrim=end={DURATION}[mix]')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(effects),'-i',str(song),'-filter_complex',graph,'-map','[mix]','-ar',str(RATE),'-ac','2','-c:a','pcm_s16le',str(output)],check=True)


def build(output,assets_root,review=True,resume=False):
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    expected=[output/'effects-only.wav',output/'audio-report.json']+([output/'review-with-song.wav'] if review else [])
    if any(p.exists() or p.is_symlink() for p in expected):
        if resume and all(p.is_file() for p in expected):
            report=json.loads((output/'audio-report.json').read_text())
            validate_report(report,output,review)
            print(f'REUSED verified audio without rewriting: {output}')
            return report
        raise FileExistsError(f'Audio output already exists and is preserved: {output}. Use --resume for complete verified audio, or choose a fresh directory.')
    source=Path(assets_root)/'build/awakening-film.mp4'
    song=Path(assets_root)/'audio'/f"{MANIFEST['opener']['track_id']}.mp3"
    dependencies=dependency_hashes(assets_root)
    m=compose()
    add_opening(m,source)
    effects=output/'effects-only.wav'
    with tempfile.TemporaryDirectory(prefix='.audio-',dir=output) as temp:
        staged=Path(temp)/effects.name
        peak=m.write(staged)
        report={'assets_root':str(Path(assets_root).resolve()),'dependency_hashes':dependencies,'manifest_sha256':manifest_sha256(),'seed':351050,'sample_rate':RATE,'samples':round(DURATION*RATE),'channels':2,'effects_only':True,'pre_limit_peak':peak,'song_playback_sample':round(AUDIO['songPlayback']*RATE),'song_first_hit_sample':round(CUES['stylusContact']*RATE),'effects_loudness':loudness(staged),'effects_sha256':digest(staged),'failure_silence_seconds':[8.62,8.9]}
        if review:
            target=Path(temp)/'review-with-song.wav'
            write_review(staged,song,target)
            report['review_loudness']=loudness(target)
            report['review_has_embedded_song']=True
            report['review_sha256']=digest(target)
        report_path=Path(temp)/'audio-report.json';report_path.write_text(json.dumps(report,indent=2)+'\n')
        if dependencies!=dependency_hashes(assets_root):raise RuntimeError('Audio dependencies changed during generation; no media published')
        for path in expected:publish_new(Path(temp)/path.name,path)
    print(json.dumps(report,indent=2))
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--assets-root',type=Path,required=True)
    p.add_argument('--effects-only',action='store_true')
    p.add_argument('--resume',action='store_true')
    a=p.parse_args();build(a.output_dir,a.assets_root,not a.effects_only,a.resume)
