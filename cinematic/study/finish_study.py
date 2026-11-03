"""Summarise measured evidence and build a local review index."""
import csv
import hashlib
import html
import json
import math
from pathlib import Path
import statistics
import subprocess
from assemble_study import OUT,ROOT,EDITS,run


def compare():
    records=[]
    shots=["coin","mechanical","carousel-a","canyon-sparse","vinyl","stylus","landing","fast-canyon"]
    movies=[]
    for shot in shots:
        source="landing-cycles" if shot=="landing" else shot
        a=json.loads((OUT/f"compare-{source}-30/render.json").read_text())
        b=json.loads((OUT/f"compare-{source}-60/render.json").read_text())
        bm={round(f["seconds"],6):f for f in b["frames"]}
        error=max(math.dist(f["cameraPosition"],bm[round(f["seconds"],6)]["cameraPosition"]) for f in a["frames"])
        assert error<.0001
        lens_error=max(abs(f["lens"]-bm[round(f["seconds"],6)]["lens"]) for f in a["frames"])
        assert lens_error<.0001
        records.append({"shot":shot,"sharedTimeCameraError":error,"sharedTimeLensError":lens_error,
                        "native30Frames":len(a["frames"]),"native60Frames":len(b["frames"]),"seconds":.8,
                        "shutter30Sec":1/60,"shutter60Sec":1/120})
        target=OUT/f"side-by-side-{shot}.mp4"
        run("ffmpeg","-y","-loglevel","error","-stream_loop","2","-i",OUT/f"compare-{source}-30.mp4",
            "-stream_loop","2","-i",OUT/f"compare-{source}-60.mp4","-filter_complex",
            "[0:v]fps=60[a];[a][1:v]hstack=inputs=2[v]","-map","[v]","-t","2.4","-c:v","libx264","-crf","18","-pix_fmt","yuv420p",target)
        movies.append(target)
    listing=OUT/"compare-concat.txt";listing.write_text("\n".join(f"file '{p}'" for p in movies))
    run("ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",listing,"-c","copy",OUT/"native-30-60-comparison.mp4")
    (OUT/"native-comparison.json").write_text(json.dumps(records,indent=2))


def benchmarks():
    rows=[]
    for p in sorted(OUT.glob("bench-*/render.json")):
        d=json.loads(p.read_text());f=d["frames"]
        assert len(f)==(3 if p.parent.name=="bench-mega-approved" else 1)
        warm=statistics.mean(x["wallSec"] for x in f[1:]) if len(f)>1 else None
        row={"scene":p.parent.name[6:],"fps":d["fps"],"samples":d["samples"],"blur":d["motionBlur"],
             "coldSec":f[0]["wallSec"],"warmSec":warm,"modelSec":warm if warm is not None else f[0]["wallSec"],"framesMeasured":len(f),
             "minSec":min(x["wallSec"] for x in f),"maxSec":max(x["wallSec"] for x in f),
             "maxRssGiB":max(x["peakRssBytes"] for x in f)/1024**3,
             "meanPngMiB":statistics.mean(x["bytes"] for x in f)/1024**2,"meshVertices":d["meshVertices"],"objects":d["objects"]}
        rows.append(row)
    by={r["scene"]:r for r in rows}
    assert len(by)==12
    weights={"approved-19.25-60":{"mega-approved":401,"mega-dark":272,"carousel-approved":27,"contact-approved":65,"landing-approved":204}}
    for name,carousel,canyon in [("30",90,189),("35",120,309),("38.5",150,384)]:
        weights[f"study-{name}-30"]={"mega-study":214,"mega-dark":98,"carousel-study":51+carousel,"carousel-approved":30,
                                    "canyon-sparse":canyon,"contact-study":33,"landing-approved":102}
    estimates=[]
    for name,w in weights.items():
        measured=sum(count*by[scene]["modelSec"] for scene,count in w.items())
        # A planning range, not a confidence interval: prototypes omit detailed
        # surfacing/volumetrics, and the sampled windows do not cover every shot.
        estimates.append({"version":name,"newBlenderFrames":sum(w.values()),"frameWeights":w,
                          "weightedHours":measured/3600,"planningLowHours":measured*.75/3600,
                          "planningHighHours":measured*2.5/3600,
                          "estimatedPngGiB":sum(count*by[scene]["meanPngMiB"] for scene,count in w.items())/1024})
    data={"hardware":"Apple Mac mini M2 Pro / 10-core CPU / 16-core Metal GPU / 16 GiB unified memory",
          "method":"1920x1080 Cycles/Metal PNG spots with production samples and denoising. Three consecutive approved hall frames (cold plus two warm); one cold frame per other class. Cold timings include render setup/denoising/write, but exclude Python scene construction. No full-quality movie.",
          "benchmarks":rows,"estimates":estimates,
          "limits":["RSS is process resident memory, not a complete Metal/unified-memory allocation measurement.",
                    "Only the approved hall has warm repeats. Other classes use conservative cold frame timings; this is not a statistical confidence interval.",
                    "Canyon is greybox; production geometry, surfacing, moving actors and atmosphere remain unpriced.",
                    "Landing cost uses the approved native-60 benchmark as a proxy for the native-30 study.",
                    "Transfer-shot cost uses the carousel-study benchmark; dark opening/failure portions use the dark-hall sample. Neither is a full shot-by-shot benchmark.",
                    "The dark-hall proxy has motion blur enabled, including when used to weight the approved version. See the per-scene settings rather than treating every proxy as the exact approved shot.",
                    "Mesh-vertex counts cover directly linked mesh objects; collection-instance expansion is not included.",
                    "Original opening cabinet is reused: 186 source frames at 60 or 93 displayed frames at 30 incur no new Blender render."]}
    (OUT/"render-costs.json").write_text(json.dumps(data,indent=2))
    with (OUT/"benchmarks.csv").open("w") as f:
        writer=csv.DictWriter(f,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
    lines=["# Measured render costs","",data["method"],"",data["hardware"],"",
           "| Scene | fps | Samples | Blur | Cold s | Warm s/frame | Peak RSS GiB | PNG MiB |",
           "|---|---:|---:|---|---:|---:|---:|---:|"]
    for r in rows:
        warm_text=f"{r['warmSec']:.2f}" if r["warmSec"] is not None else "not measured"
        lines.append(f"| {r['scene']} | {r['fps']} | {r['samples']} | {r['blur']} | {r['coldSec']:.2f} | {warm_text} | {r['maxRssGiB']:.2f} | {r['meanPngMiB']:.2f} |")
    lines.extend(["","| Cut | Newly rendered Blender frames | Measured-weight extrapolation h | Planning range h | PNG GiB |",
                  "|---|---:|---:|---:|---:|"])
    for r in estimates:lines.append(f"| {r['version']} | {r['newBlenderFrames']} | {r['weightedHours']:.2f} | {r['planningLowHours']:.2f}–{r['planningHighHours']:.2f} | {r['estimatedPngGiB']:.2f} |")
    lines.extend(["","The planning range is a stated 0.75–2.5× allowance around sampled render time. It is not a measured confidence interval. Development, sound work and integration are separate. Allow 3× the PNG estimate for alternate versions, temporary frames and review encodes.","",*data["limits"]])
    (OUT/"RENDER-COSTS.md").write_text("\n".join(lines)+"\n")


def page():
    entries=[("Start with the 35-second cut","animatic-35-with-song.mp4","Native 30 fps studies; existing coin opening cadence-adapted from 60. Temporary effects and opening song are embedded for review only."),
             ("Compare: 38.5 seconds","animatic-38.5-with-song.mp4","Longest canyon journey; unchanged C1 ending."),
             ("Compare: 30 seconds","animatic-30-with-song.mp4","Same story, faster continuous carousel and canyon cameras."),
             ("Mechanical continuity","mechanical-continuity.mp4","Existing failed drive and robot recovery, followed by a new greybox transmission into the index ring."),
             ("Carousel A — label pass and rising reveal","carousel-a.mp4","Existing 60-record array. New camera and lighting."),
             ("Carousel B — orbital sweep","carousel-b.mp4","Alternative camera on the same magazine."),
             ("Groove — restrained world","canyon-sparse-v2.mp4","V-profile/pitch ratios retained; sparse below-surface utilities. Exit approaches the original stylus framing."),
             ("Groove — richer world","canyon-rich-v2.mp4","More structures, bridges and moving service carriers. Greybox, with no production surfacing."),
             ("Native 30/60 comparison reel","native-30-60-comparison.mp4","Left 30, right 60. Each source independently rendered at its native rate. 60 fps comparison container repeats left frames for display; no interpolation."),
             ("Cycles groove 30","cycles-canyon-30.mp4","8-sample Cycles shutter test. Native 30 fps, 180° shutter."),
             ("Cycles groove 60","cycles-canyon-60.mp4","Same continuous motion. Native 60 fps, 180° shutter.")]
    body="".join(f'<section><h2>{html.escape(title)}</h2><p>{html.escape(desc)}</p><video controls preload="none" playsinline src="{file}"></video><p><a href="{file}">Open video</a></p></section>' for title,file,desc in entries)
    (OUT/"index.html").write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Song Inside — study review</title><style>body{margin:40px auto;max-width:1000px;padding:0 24px;background:#121414;color:#eee;font:17px/1.6 system-ui}h1{font-size:38px;line-height:1.2}h2{font-size:23px}p{max-width:78ch;color:#bec6c4}a{color:#b4d9e3}section{margin:48px 0}video{display:block;width:100%;background:#000;max-height:560px}nav{display:flex;gap:24px;flex-wrap:wrap}small{color:#aaa}</style><h1>The Song Inside</h1><p>30 fps cinematic exploration · 3 November 2026 · Local review only</p><p>These are camera and pacing studies. The approved production branch, live application, manifests and hosted media are untouched. All new sets and effects remain unfinished.</p><nav><a href="../../../cinematic/study/REPORT.md">Read assessment</a><a href="RENDER-COSTS.md">Measured costs</a><a href="render-costs.json">Raw measurements</a><a href="editorial.json">Editorial timing</a></nav>'''+body+'<p><a href="handoff-diagnostic.html">Play the isolated 30 fps to live CSS handoff diagnostic</a></p><p>No final production film, deployment or event acceptance is implied by these previews.</p></html>')


def continuity():
    run("ffmpeg","-y","-loglevel","error","-i",OUT/"mechanical.mp4","-i",OUT/"transmission-v2.mp4",
        "-filter_complex","[0:v]trim=end_frame=241,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=51,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]",
        "-map","[v]","-c:v","libx264","-crf","19","-pix_fmt","yuv420p",OUT/"mechanical-continuity.mp4")


def main():
    compare();benchmarks();continuity();page()
    sources={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/"cinematic/study").glob("*") if p.is_file()}
    (OUT/"study-source-sha256.json").write_text(json.dumps(sources,indent=2))


if __name__=="__main__":main()
