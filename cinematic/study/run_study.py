"""Render only cheap previews and explicitly selected benchmark stills."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"build/awakening-30fps-study/v1"
RENDER=ROOT/"cinematic/study/render_study.py"


def render(name,shot,fps=30,start=0,end=1,engine="eevee",samples=8,width=480,height=270,still=None,extra=()):
    dest=OUT/name
    dest.mkdir(parents=True,exist_ok=True)
    if (dest/"render.json").exists():
        info=json.loads((dest/"render.json").read_text())
        expected=1 if still is not None else round(end*fps)-round(start*fps)
        if name.startswith("bench-") and name!="bench-mega-approved":expected=1
        if len(info["frames"])==expected:
            print("COMPLETE "+name,flush=True);return
        raise RuntimeError(f"Incomplete {dest}; choose a fresh output version or inspect before removing study frames")
    cmd=["blender","-b","--python-exit-code","1","--python",str(RENDER),"--","--shot",shot,
         "--fps",str(fps),"--start",str(start),"--end",str(end),"--engine",engine,"--samples",str(samples),
         "--width",str(width),"--height",str(height),"--out",str(dest),*extra]
    if still is not None: cmd.extend(["--still",str(still)])
    print("RENDER "+name,flush=True)
    t=time.monotonic()
    with (OUT/(name.replace("/","-")+".log")).open("w") as log:
        subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
    print(f"FINISHED {name} {time.monotonic()-t:.1f}s",flush=True)


def main():
    ap=argparse.ArgumentParser();ap.add_argument("mode",choices=["previews","comparisons","benchmarks","refine","final-proxies"])
    args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
    if args.mode=="previews":
        for name,start,end in [("mechanical",5.4666666667,15.2),("carousel-a",0,5),("carousel-b",0,5),
                               ("canyon-sparse",0,13.9),("canyon-rich",0,13.9),("vinyl",0,1),
                               ("stylus",175/60,240/60),("landing",240/60,444/60)]:
            render(name,name,start=start,end=end,extra=("--save",))
    elif args.mode=="final-proxies":
        render("bench-mega-dark","baseline-dark",60,8.4,8.4+1/60,"cycles",128,1920,1080)
        render("transmission-v2","transmission",end=1.7,extra=("--save",))
        render("stylus-exact","stylus",end=1.1,engine="cycles",samples=4,extra=("--source-origin-sec",str(175/60),"--save"))
        render("landing-cycles","landing",start=4,end=7.4,engine="cycles",samples=4,extra=("--save",))
        for fps in (30,60):render(f"compare-landing-cycles-{fps}","landing",fps,6.4,7.2,"cycles",4)
    elif args.mode=="refine":
        render("transmission","transmission",end=1.7,extra=("--save",))
        for name,shot,length in [("canyon-sparse-v2","canyon-sparse",385/30),("canyon-rich-v2","canyon-rich",385/30),
                                 ("canyon-35","canyon-sparse",310/30),("canyon-30","canyon-sparse",190/30),
                                 ("carousel-35","carousel-a",4),("carousel-30","carousel-a",3)]:
            render(name,shot,end=length,extra=("--motion-duration",str(length),"--save"))
        for fps in (30,60):
            render(f"compare-fast-canyon-{fps}","canyon-sparse",fps,2.5,3.3,extra=("--motion-duration",str(190/30)))
    elif args.mode=="comparisons":
        for shot,start,end in [("coin",4,4.8),("mechanical",12.2,13),("carousel-a",2.4,3.2),
                               ("canyon-sparse",4.6,5.4),("vinyl",1.4,2.2),("stylus",3.6,4.4),("landing",6.4,7.2)]:
            for fps in (30,60): render(f"compare-{shot}-{fps}",shot,fps,start,end)
        # Verify the fastest movement with ray-traced shutter integration too.
        for fps in (30,60): render(f"cycles-canyon-{fps}","canyon-sparse",fps,4.6,5.4,"cycles",8)
    else:
        # Representative production-size STILL frames only; never a full film.
        for name,shot,seconds,samples,fps,blur in [
            ("mega-approved","baseline-story",13.3,128,60,False),
            ("mega-study","mechanical",12.8,128,30,True),
            ("carousel-approved","baseline-carousel",2,96,60,False),
            ("carousel-study","carousel-a",3.4,96,30,True),
            ("vinyl-approved","stylus",3,96,60,False),
            ("contact-approved","stylus",4,96,60,False),
            ("contact-study","stylus",4,96,30,True),
            ("landing-approved","landing",6.8,96,60,False),
            ("canyon-sparse","canyon-sparse",5,96,30,True),
            ("canyon-rich","canyon-rich",5,96,30,True),
            ("canyon-no-blur","canyon-rich",5,96,30,False)]:
            render("bench-"+name,shot,fps,start=seconds,end=seconds+3/fps,engine="cycles",samples=samples,width=1920,height=1080,
                   extra=() if blur else ("--no-blur",))
    print("DONE "+args.mode,flush=True)


if __name__=="__main__": main()
