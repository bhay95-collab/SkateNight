#!/usr/bin/env python3
"""Cut the director's cut animatic from its sources, on the cues.json frame grid.

    python3 cinematic/assemble_animatic.py

  film 0..coinGone-1          the existing browser film (basement, coin, slot)
  film coinGone..toRecord-1   story_megastructure.py frames (the machine's beats)
  film toRecord..approach-1   hero_groove.py --shot wideseq (the record world)
  film approach..final        hero_groove.py pullback frames, offset by the groove contact
Writes animatic.mp4 (the film: effects bed only; the jukebox plays the song) and
animatic-with-song.mp4 (a review mix with the opener laid in at song.startSec, to
hear the handoff; never imported into the app).
"""
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
F, G = CUES["frames"], CUES["groove"]
OUT = ROOT / "build" / "cinematic-phase4"
A = OUT / "animatic"
W, H = 960, 540
FFMPEG = shutil.which("ffmpeg")


def main():
    offset = F["stylusContact"] - G["contactFrame"]
    segments = [
        (["-i", str(ROOT / "build" / "awakening-film.mp4")], F["coinGone"]),
        (["-framerate", "60", "-start_number", str(F["coinGone"]), "-i", str(A / "story" / "frame_%04d.png")],
         F["toRecord"] - F["coinGone"]),
        (["-framerate", "60", "-start_number", "120", "-i", str(OUT / "groove" / "wideseq" / "frame_%04d.png")],
         F["stylusApproach"] - F["toRecord"]),
        (["-framerate", "60", "-start_number", str(F["stylusApproach"] - offset), "-i",
          str(OUT / "groove" / "pullback" / "frame_%04d.png")], F["final"] + 1 - F["stylusApproach"]),
    ]
    inputs, graph = [], []
    for i, (args, count) in enumerate(segments):
        inputs += args
        graph.append(f"[{i}:v]trim=end_frame={count},setpts=PTS-STARTPTS,"
                     f"scale={W}:{H}:flags=lanczos,fps=60,format=yuv420p,setsar=1[s{i}]")
    total = sum(count for _, count in segments)
    assert total == F["final"] + 1, total
    graph.append("".join(f"[s{i}]" for i in range(len(segments))) + f"concat=n={len(segments)}:v=1:a=0[v]")
    inputs += ["-i", str(A / "sfx-bed.wav")]
    film = A / "animatic.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(graph),
                    "-map", "[v]", "-map", f"{len(segments)}:a", "-r", "60", "-frames:v", str(total),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(film)], check=True)
    song_ms = round(CUES["song"]["startSec"] * 1000)
    mix = A / "animatic-with-song.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(film), "-i",
                    str(ROOT / "audio" / f"{CUES['opener']['trackId']}.mp3"), "-filter_complex",
                    f"[1:a]adelay={song_ms}|{song_ms},volume=0.8[s];[0:a][s]amix=inputs=2:normalize=0:duration=first[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(mix)], check=True)
    print(f"WROTE {film}\nWROTE {mix}\n{total} frames = {total / 60:.3f} s")


if __name__ == "__main__":
    main()
