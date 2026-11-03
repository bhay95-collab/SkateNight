"""Encode study clips, create three editorial cuts and separate temporary effects.

The cabinet/coin opening is a cadence-adapted existing proxy. All new studies
and matched frame-rate tests are separate native Blender evaluations.
"""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import wave

ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path("/Users/benjaminhay/SkateNight")
OUT=ROOT/"build/awakening-30fps-study/v1"
sys.path.insert(0,str(ROOT/"cinematic"))
import sound_bed as sb
from frame_io import png_dimensions


def run(*args): subprocess.run([str(a) for a in args],check=True)


def quantize(t,fps=30): return math.floor(t*fps+.5)


def label_image(text,path):
    binary=OUT/"label-tool"
    if not binary.exists():run("swiftc",ROOT/"cinematic/study/label.swift","-o",binary)
    run(binary,text,path)


def encode(directory):
    info=json.loads((directory/"render.json").read_text())
    frames=info["frames"]
    for item in frames:
        assert png_dimensions(directory/f"frame_{item['frame']:05d}.png")== (info["width"],info["height"])
    movie=OUT/(directory.name+".mp4")
    text=f"STUDY / {info['shot']} / NATIVE {info['fps']} fps / {info['engine']} / 180 deg"
    label=OUT/(directory.name+"-label.png");label_image(text,label)
    run("ffmpeg","-y","-loglevel","error","-framerate",info["fps"],"-start_number",frames[0]["frame"],
        "-i",directory/"frame_%05d.png","-i",label,"-frames:v",len(frames),"-filter_complex",
        "[0:v][1:v]overlay=0:0",
        "-c:v","libx264","-crf","19","-preset","fast","-pix_fmt","yuv420p","-movflags","+faststart",movie)
    return movie


def effects():
    cue=json.loads((ROOT/"cinematic/study/cues.json").read_text())
    sec=cue["seconds"]
    F={k:quantize(v,60) if isinstance(v,(int,float)) else [quantize(t,60) for t in v] for k,v in sec.items()}
    F["toRecord"]=quantize(sec["activeRecord"],60)
    F["lockBeats"]=[quantize(sec["ignite"]+i*.4465,60) for i in range(8)]
    sb.F=F
    sb.CUES={**sb.CUES,"song":cue["song"],"supply":{"points":[(0,.2),(F["relay"],.2),(F["attempt"],.03),
        (F["almost"],.55),(F["failure"],.4),(F["failure"]+20,0),(F["catch"],0),
        (F["catch"]+8,.3),(F["ignite"],1),(F["toRecord"],.7)]}}
    mix=sb.Mix(38.5)
    coin=OUT/"source-coin.wav"
    run("ffmpeg","-y","-loglevel","error","-i",SOURCE/"build/awakening-film.mp4","-t","5.4","-vn","-ac","2","-ar","48000","-c:a","pcm_s16le",coin)
    sb.add_coin(mix,coin);sb.add_coin_journey(mix);sb.add_attempt(mix)
    for i in range(round(8.6*48000),round(9.2*48000)):
        gain=max(0,1-(i/48000-8.6)/.2)
        mix.l[i]*=gain;mix.r[i]*=gain
    mix.add(8.9,sb.ring([(2600,.6),(5100,.3)],.08,.01),.1)
    mix.add(9.2,sb.thump(42,.5,.12,.25),.3)
    for i,t in enumerate(sec["heartbeats"]+[sec["ignite"]+i*.4465 for i in range(8)]):
        mix.add(t,sb.thump(52,.3,.07,.15),.20+min(.15,i*.015))
        mix.add(t+.085,sb.thump(60,.22,.05,.1),.12)
    mix.add(sec["ignite"],sb.machine(sec["ignite"],20.2,.12))
    for t in (13.5,14.4,15.2,18.6,20.2):
        mix.add(t,sb.ring([(182,.5),(417,.3),(933,.15)],.5,.09),.12)
    mix.add(21.2,sb.noise(13.9,150,lambda t:.22*math.sin(math.pi*t/13.9)**2),.2)
    for t in (24.2,26.8,29.1):
        mix.add(t,sb.noise(.8,600,lambda x:.25*math.sin(math.pi*x/.8)**2),.14,pan=-.5)
    mix.add(34,sb.noise(1.1,1600,lambda t:.2*math.sin(math.pi*t/1.1)**2),.1)
    mix.add(35.1,sb.thump(90,.25,.04,.05,(1,.2)),.14)
    mix.add(35.1,sb.crackle(.8,14,.08),.28)
    for i in range(round(34.893*48000),mix.n):
        gain=max(0,1-(i/48000-34.893)/1.1)**2
        mix.l[i]*=gain;mix.r[i]*=gain
    mix.write(OUT/"temporary-effects-38.5.wav")


# Source intervals are seconds within study clips, except opening's approved
# source-film clock. Each cut keeps opening and C1 at original playback speed.
EDITS={
    "38.5":[("opening",0,164), ("mechanical",0,241),("transmission",0,51),("carousel-a",0,150),("vinyl",0,30),
             ("canyon-sparse-v2",0,384),("stylus",0,33),("landing",0,102)],
    "35":[("opening",0,164),("mechanical",0,241),("transmission",0,51),("carousel-35",0,120),("vinyl",0,30),
           ("canyon-35",0,309),
           ("stylus",0,33),("landing",0,102)],
    "30":[("opening",0,164),("mechanical",0,241),("transmission",0,51),("carousel-30",0,90),("vinyl",0,30),
           ("canyon-30",0,189),
           ("stylus",0,33),("landing",0,102)]
}


def full_cut(name,edit):
    chunks=[]
    for i,(shot,start,count) in enumerate(edit):
        source=SOURCE/"build/awakening-final-prep-v27/preview/coin-journey/coin-journey-preview.mp4" if shot=="opening" else OUT/(shot+".mp4")
        if shot=="landing":source=OUT/"landing-cycles.mp4"
        if shot=="stylus":source=OUT/"stylus-exact.mp4"
        if shot=="transmission":source=OUT/"transmission-v2.mp4"
        target=OUT/f"edit-{name}-{i}.mp4"
        label="EXISTING OPENING / 60 to 30 fps proxy" if shot=="opening" else f"{shot} / GREYBOX STUDY"
        if shot=="landing":label="APPROVED C1 / STATIC UI REGISTRATION PROXY"
        labelpath=OUT/f"edit-{name}-{i}.png";label_image(label,labelpath)
        extra=[]
        graph=f"[0:v]fps=30,trim=start_frame={start}:end_frame={start+count},setpts=PTS-STARTPTS,scale=480:270,setsar=1[v]"
        if shot=="landing":
            extra=["-loop","1","-framerate","30","-i",SOURCE/"build/cinematic-phase4/ui-plate.png"]
            u="clip((T-2.666666667)/0.7,0,1)"
            expression=f"if(lte(hypot(X-289.5,Y-105.35),23.5),A,A*(1-{u})+B*{u})"
            graph+=f";[v]format=gbrp[film];[2:v]scale=480:270,setsar=1,format=gbrp[plate];[film][plate]blend=all_expr='{expression}'[registered];[registered][1:v]overlay=0:H-h"
        else:graph+=";[v][1:v]overlay=0:H-h"
        run("ffmpeg","-y","-loglevel","error","-i",source,"-i",labelpath,*extra,"-an","-filter_complex",graph,
            "-frames:v",count,"-c:v","libx264","-crf","19","-pix_fmt","yuv420p",target)
        chunks.append(target)
    total=sum(e[2] for e in edit)
    listing=OUT/f"concat-{name}.txt";listing.write_text("\n".join("file '"+str(p)+"'" for p in chunks))
    silent=OUT/f"animatic-{name}-silent.mp4"
    run("ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",listing,"-c","copy",silent)
    # Rebuild timing by cutting the authored effects at the same picture edits.
    # The opening/song are never time stretched.
    original_start={"opening":0,"mechanical":164,"transmission":405,"carousel-a":456,"carousel-35":456,"carousel-30":456,
                    "vinyl":606,"canyon-sparse-v2":636,"canyon-35":636,"canyon-30":636,"stylus":1020,"landing":1053}
    effects_segments=[]
    for i,(shot,start,count) in enumerate(edit):
        a=(original_start[shot]+start)/30;b=a+count/30
        effects_segments.append(f"[1:a]atrim=start={a:.9f}:end={b:.9f},asetpts=PTS-STARTPTS[e{i}]")
    effects_segments.append("".join(f"[e{i}]" for i in range(len(edit)))+f"concat=n={len(edit)}:v=0:a=1[fx]")
    contact_frame=total-102
    song_start=contact_frame/30-.207
    effects_segments.append(f"[2:a]adelay={song_start*1000:.3f}:all=1,atrim=duration={total/30:.9f}[song]")
    effects_segments.append("[fx][song]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=0:latency=1[a]")
    output=OUT/f"animatic-{name}-with-song.mp4"
    run("ffmpeg","-y","-loglevel","error","-i",silent,"-i",OUT/"temporary-effects-38.5.wav","-i",SOURCE/"audio/praise-lifted-on-high.mp3",
        "-filter_complex",";".join(effects_segments),"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",
        "-t",f"{total/30:.9f}","-movflags","+faststart",output)
    seconds=json.loads((ROOT/"cinematic/study/cues.json").read_text())["seconds"]
    seconds={k:v for k,v in seconds.items() if k not in ("activeRecord","grooveDescent","canyonFlight","grooveExit","stylusApproach","stylusContact","registrationStart","final")}
    car_frames=next(x[2] for x in edit if x[0].startswith("carousel"))
    canyon_frames=next(x[2] for x in edit if x[0].startswith("canyon"))
    descent=15.2+car_frames/30+1
    canonical_motion=(canyon_frames+1)/30
    seconds.update(activeRecord=descent-1,grooveDescent=descent,canyonFlight=descent+2.2/13.9*canonical_motion,
                   grooveExit=descent+9.3/13.9*canonical_motion,stylusApproach=contact_frame/30-1.1,
                   stylusContact=contact_frame/30,registrationStart=contact_frame/30+80/30,final=(total-1)/30)
    visual={k:[quantize(t) for t in v] if isinstance(v,list) else quantize(v) for k,v in seconds.items()}
    timeline={"fps":30,"frameCount":total,"durationSec":total/30,"sourceSeconds":seconds,"visualFrames":visual,
              "visualSeconds":{k:[f/30 for f in v] if isinstance(v,list) else v/30 for k,v in visual.items()},
              "audioSeconds":{"songPlayback":song_start,"firstHit":contact_frame/30,"coinImpact":5.25},
              "productionManifest":False}
    (OUT/f"timeline-{name}.json").write_text(json.dumps(timeline,indent=2))
    return {"name":name,"frames":total,"durationSec":total/30,"contactFrame":contact_frame,"contactSec":contact_frame/30,"songStartSec":song_start,"edit":edit}


def main():
    ap=argparse.ArgumentParser();ap.add_argument("mode",choices=["clips","cuts","verify"]);args=ap.parse_args()
    if args.mode=="clips":
        for p in sorted(OUT.iterdir()):
            if p.is_dir() and (p/"render.json").exists() and not p.name.startswith(("bench-","sensitivity-")): encode(p)
    elif args.mode=="cuts":
        effects();results=[full_cut(name,edit) for name,edit in EDITS.items()]
        (OUT/"editorial.json").write_text(json.dumps(results,indent=2))
    else:
        records=[]
        for p in sorted(OUT.glob("*.mp4")):
            if p.name.startswith("edit-"):continue
            info=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries","stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels","-of","json",str(p)]))
            records.append({"file":p.name,"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size,"streams":info["streams"]})
        for name,edit in EDITS.items():
            item=next(x for x in records if x["file"]==f"animatic-{name}-with-song.mp4")
            video=next(s for s in item["streams"] if s["codec_type"]=="video")
            assert int(video["nb_frames"])==sum(x[2] for x in edit)
            assert video["r_frame_rate"]=="30/1"
            assert abs(float(video["duration"])-float(name))<1/30
            audio=next(s for s in item["streams"] if s["codec_type"]=="audio")
            assert audio["codec_name"]=="aac" and audio["sample_rate"]=="48000" and audio["channels"]==2
        (OUT/"media-verification.json").write_text(json.dumps(records,indent=2))


if __name__=="__main__":main()
