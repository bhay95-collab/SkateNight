"""Cut the Phase 4 render frames into review movies (plain Python + FFmpeg, no Blender).

    python3 cinematic/assemble_review.py

Every movie is native 60 fps: one rendered frame per output frame, except the
hybrid's compressed pullback, which blends neighbouring rendered frames (motion
blur) rather than duplicating any. The three transition variants share the
same frames, so they differ only in the cut:
  pinned     the full pullback, crossfading into the exact UI screenshot on the reveal beat
  matchcut   a hard cut on the contact beat: the stylus sits on the same pixel either side
  hybrid     contact, then the pullback compressed 2.5x, landing on the same UI frame
"""
import shutil
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "build" / "cinematic-phase4"
FRAMES = OUT / "groove" / "pullback" / "frame_%04d.png"
UI = OUT / "ui-plate.png"
F_CONTACT, F_END = 240, 443          # hero_groove.py: contact on the first hit, end on revealAt
HOLD, FADE = 60, 12                  # frames of live UI after the landing; crossfade length
W, H = 1280, 720
FFMPEG = shutil.which("ffmpeg")


def encode(graph, inputs, dst):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[v]",
                    "-r", "60", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", str(dst)], check=True)
    print(f"WROTE {dst}")


def frames(start, count):
    return ["-framerate", "60", "-start_number", str(start), "-i", str(FRAMES)]   # count: trimmed in the graph


def ui(seconds):
    return ["-loop", "1", "-framerate", "60", "-t", f"{seconds}", "-i", str(UI)]


def main():
    movies = OUT / "review" / "media"
    movies.mkdir(parents=True, exist_ok=True)
    scale = f"scale={W}:{H}:flags=lanczos,format=yuv420p,setsar=1"
    n, cut = F_END, F_CONTACT + 3
    encode(f"[0]{scale},trim=end_frame={n}[a];[1]{scale}[b];"
           f"[a][b]xfade=transition=fade:duration={FADE / 60}:offset={(n - FADE) / 60}[v]",
           [*frames(1, n), *ui((HOLD + FADE) / 60)], movies / "C1-pinned-pullback.mp4")
    encode(f"[0]{scale},trim=end_frame={cut}[a];[1]{scale}[b];[a][b]concat=n=2:v=1:a=0[v]",
           [*frames(1, cut), *ui(HOLD / 60 + 1)], movies / "C2-precision-match-cut.mp4")
    fast = n - cut
    encode(f"[0]{scale},trim=end_frame={cut},settb=1/60[a];"
           f"[1]{scale},trim=end_frame={fast},tmix=frames=3,setpts=(PTS-STARTPTS)/2.5,fps=60,settb=1/60[p];[2]{scale},settb=1/60[b];"
           f"[a][p]concat=n=2:v=1:a=0,settb=1/60[ap];[ap][b]xfade=transition=fade:duration={FADE / 60}:"
           f"offset={(cut + round(fast / 2.5) - FADE) / 60}[v]",
           [*frames(1, cut), *frames(cut + 1, fast), *ui((HOLD + FADE) / 60)], movies / "C3-hybrid.mp4")
    mega = OUT / "megastructure" / "motion"
    if (mega / "frame_0300.png").exists():
        encode(f"[0]{scale}[v]", ["-framerate", "60", "-start_number", "1", "-i", str(mega / "frame_%04d.png")],
               movies / "A-megastructure-push.mp4")


if __name__ == "__main__":
    main()
