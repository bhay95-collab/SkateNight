#!/usr/bin/env python3
"""Prepare, preview, or render the cue-locked Awakening production master."""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
F = CUES["frames"]
DEFAULT_OUTPUT = ROOT / "build" / "awakening-final-render"
BLENDER = shutil.which("blender")
FFMPEG = shutil.which("ffmpeg")


def run(command, args, env=None):
    subprocess.run([str(command), *map(str, args)], check=True, env=env)


def verify_frames(directory, start, end, width, height):
    from frame_io import png_dimensions

    for frame in range(start, end + 1):
        path = directory / f"frame_{frame:04d}.png"
        if png_dimensions(path) != (width, height):
            raise RuntimeError(f"Blender did not produce a valid {width}x{height} frame: {path}")


def verify_preview_movie(path, frame_count):
    result = subprocess.run(
        [
            shutil.which("ffprobe"), "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels",
            "-show_entries", "format=duration", "-of", "json", str(path),
        ],
        check=True, capture_output=True, text=True,
    )
    info = json.loads(result.stdout)
    video = next((stream for stream in info["streams"] if stream["codec_type"] == "video"), None)
    audio = next((stream for stream in info["streams"] if stream["codec_type"] == "audio"), None)
    expected_duration = frame_count / CUES["fps"]
    expected_audio_duration = F["coinImpact"] / CUES["fps"] + 2.4
    if (video is None or audio is None or video["codec_name"] != "h264" or audio["codec_name"] != "aac"
            or video["width"] != 480 or video["height"] != 270 or video["r_frame_rate"] != "60/1"
            or int(video["nb_frames"]) != frame_count or int(audio["sample_rate"]) != 48000
            or int(audio["channels"]) != 2 or abs(float(video["duration"]) - expected_duration) > 1 / 60
            or float(audio["duration"]) < expected_audio_duration - 1 / 60):
        raise RuntimeError(f"Transition preview failed media verification: {info}")


def require_sources():
    required = (
        ROOT / "build" / "awakening-film.mp4",
        ROOT / "build" / "cinematic-phase4" / "ui-plate.png",
        ROOT / "audio" / f"{CUES['opener']['trackId']}.mp3",
    )
    missing = [path for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Required production source(s) are missing: " + ", ".join(map(str, missing)))
    if not BLENDER or not FFMPEG or not shutil.which("ffprobe") or not shutil.which("node"):
        raise RuntimeError("Blender, FFmpeg, FFprobe, and Node.js are required for the production workflow.")
    return required[0]


def prepare_transition_assets(output, coin_movie):
    transition_dir = output / "assets" / "transition"
    transition_dir.mkdir(parents=True, exist_ok=True)
    entry_plate = transition_dir / "entry-plate.png"
    coin_texture = transition_dir / "coin-face.png"
    run(FFMPEG, (
        "-y", "-hide_banner", "-loglevel", "error", "-i", coin_movie,
        "-vf", f"select='eq(n,{F['coinGone'] - 1})'", "-vsync", "0", "-frames:v", "1", entry_plate,
    ))
    run(FFMPEG, (
        "-y", "-hide_banner", "-loglevel", "error", "-i", coin_movie,
        "-vf", "select='eq(n,90)',crop=144:144:872:476", "-vsync", "0", "-frames:v", "1", coin_texture,
    ))
    from frame_io import png_dimensions

    if png_dimensions(entry_plate) != (1920, 1080) or png_dimensions(coin_texture) != (144, 144):
        raise RuntimeError("The extracted coin-entry plate or coin-face artwork has unexpected dimensions.")
    return entry_plate, coin_texture


def render_transition_preview(output, coin_movie, resume):
    entry_plate, coin_texture = prepare_transition_assets(output, coin_movie)
    render_root = output / "preview" / "coin-journey"
    frames = render_root / "frames"
    preview_end = F["relay"] - 1
    env = os.environ.copy()
    env.update({
        "SKATENIGHT_CINEMATIC_OUT": str(output / "renderer"),
        "SKATENIGHT_COIN_ENTRY_PLATE": str(entry_plate),
        "SKATENIGHT_COIN_TEXTURE": str(coin_texture),
    })
    command = [
        BLENDER, "-b", "--python-exit-code", "1",
        "--python", ROOT / "cinematic" / "story_megastructure.py", "--",
        "--start", F["coinGone"], "--end", preview_end, "--w", 480, "--h", 270,
        "--samples", 8, "--output-dir", frames,
    ]
    if resume:
        command.append("--resume")
    run(command[0], command[1:], env=env)
    verify_frames(frames, F["coinGone"], preview_end, 480, 270)

    sound_path = output / "audio" / "sfx-bed.wav"
    stems = output / "audio" / "stems"
    run(sys.executable, (
        ROOT / "cinematic" / "sound_bed.py", "--coin", coin_movie,
        "--out", sound_path, "--stems-dir", stems,
    ))
    movie = render_root / "coin-journey-preview.mp4"
    preview_frame_count = preview_end + 1
    journey_frame_count = preview_end - F["coinGone"] + 1
    preview_duration = preview_frame_count / CUES["fps"]
    audio_end = F["coinImpact"] / CUES["fps"] + 2.4
    video_graph = (
        f"[0:v]trim=end_frame={F['coinGone']},setpts=PTS-STARTPTS,"
        "scale=480:270:flags=lanczos,fps=60,format=yuv420p,setsar=1,settb=1/60,setpts=PTS-STARTPTS[opening];"
        f"[1:v]trim=end_frame={journey_frame_count},setpts=PTS-STARTPTS,"
        "scale=480:270:flags=lanczos,fps=60,format=yuv420p,setsar=1,settb=1/60,setpts=PTS-STARTPTS[journey];"
        "[opening][journey]concat=n=2:v=1:a=0,settb=1/60,setpts=PTS-STARTPTS[preview]"
    )
    run(FFMPEG, (
        "-y", "-hide_banner", "-loglevel", "error", "-i", coin_movie,
        "-framerate", 60,
        "-start_number", F["coinGone"], "-i", frames / "frame_%04d.png",
        "-i", sound_path, "-filter_complex", video_graph,
        "-t", f"{max(preview_duration, audio_end):.9f}",
        "-map", "[preview]", "-map", "2:a:0", "-c:v", "libx264", "-preset", "medium",
        "-crf", "19", "-pix_fmt", "yuv420p", "-r", 60, "-c:a", "aac", "-b:a", "160k",
        "-ar", 48000, "-ac", 2, "-movflags", "+faststart", movie,
    ))
    verify_preview_movie(movie, preview_frame_count)
    print(f"TRANSITION PREVIEW: {movie}")


def render_full_story(output, coin_movie, resume, story_samples, groove_samples, assemble_only):
    entry_plate, coin_texture = prepare_transition_assets(output, coin_movie)
    renderer = output / "renderer"
    frames = output / "frames"
    story_frames = frames / "story"
    groove_root = frames / "groove"
    audio_root = output / "audio"
    sound_path = audio_root / "sfx-bed.wav"
    stems = audio_root / "stems"
    audio_root.mkdir(parents=True, exist_ok=True)
    run(sys.executable, (
        ROOT / "cinematic" / "sound_bed.py", "--coin", coin_movie,
        "--out", sound_path, "--stems-dir", stems,
    ))

    env = os.environ.copy()
    env.update({
        "SKATENIGHT_CINEMATIC_OUT": str(renderer),
        "SKATENIGHT_COIN_ENTRY_PLATE": str(entry_plate),
        "SKATENIGHT_COIN_TEXTURE": str(coin_texture),
    })
    if not assemble_only:
        stages = (
            (
                ROOT / "cinematic" / "story_megastructure.py",
                ("--start", F["coinGone"], "--end", F["toRecord"] - 1,
                 "--w", 1920, "--h", 1080, "--samples", story_samples,
                 "--output-dir", story_frames),
            ),
            (
                ROOT / "cinematic" / "hero_groove.py",
                ("--shot", "wideseq", "--w", 1920, "--h", 1080,
                 "--samples", groove_samples, "--output-dir", groove_root),
            ),
            (
                ROOT / "cinematic" / "hero_groove.py",
                ("--shot", "pullback", "--frame", F["stylusApproach"] -
                 (F["stylusContact"] - CUES["groove"]["contactFrame"]),
                 "--w", 1920, "--h", 1080, "--samples", groove_samples,
                 "--output-dir", groove_root),
            ),
        )
        for script, arguments in stages:
            command = [
                BLENDER, "-b", "--python-exit-code", "1",
                "--python", script, "--", *map(str, arguments),
            ]
            if resume:
                command.append("--resume")
            run(command[0], command[1:], env=env)
            if script.name == "story_megastructure.py":
                verify_frames(story_frames, F["coinGone"], F["toRecord"] - 1, 1920, 1080)
            elif "--shot" in arguments and arguments[arguments.index("--shot") + 1] == "wideseq":
                verify_frames(groove_root / "wideseq", 120, 146, 1920, 1080)
            else:
                pullback_start = F["stylusApproach"] - (
                    F["stylusContact"] - CUES["groove"]["contactFrame"]
                )
                verify_frames(groove_root / "pullback", pullback_start, CUES["groove"]["endFrame"], 1920, 1080)

    assembled = output / "assembled"
    run(sys.executable, (
        ROOT / "cinematic" / "assemble_animatic.py",
        "--coin", coin_movie,
        "--story-frames", story_frames,
        "--wide-frames", groove_root / "wideseq",
        "--pullback-frames", groove_root / "pullback",
        "--effects", sound_path,
        "--out-dir", assembled,
        "--width", 1920, "--height", 1080,
    ))

    final_movie = output / "awakening-director-cut.mp4"
    handoff = groove_root / "handoff.json"
    run(shutil.which("node"), (
        ROOT / "scripts" / "package-cinematic.mjs",
        assembled / "director-cut-master.mp4", final_movie,
        "--id", "skate-by-faith-awakening-directors-cut",
        "--title", "Skate by Faith — Awakening Director's Cut",
        "--source", "Offline Blender/Cycles Metal render on the M2 Pro Mac mini",
        "--coin-frame", 0,
        "--failure-frame", F["failure"],
        "--recovery-frame", F["catch"],
        "--stylus-frame", F["stylusContact"],
        "--handoff-frame", int(CUES["song"]["startSec"] * CUES["fps"]),
        "--song-frame", F["stylusContact"],
        "--song-start", CUES["song"]["startSec"],
        "--registration-frame", F["registrationStart"],
        "--record", handoff,
    ))
    print(f"PACKAGED UNAPPROVED LOCAL PREVIEW: {final_movie}")
    print(f"Manifest: {final_movie.with_suffix(final_movie.suffix + '.json')}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--story-samples", type=int, default=128)
    parser.add_argument("--groove-samples", type=int, default=96)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--assemble-only", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--preview-coin-journey", action="store_true")
    args = parser.parse_args()

    coin_movie = require_sources()
    output = args.output_dir.resolve()
    if args.check:
        print(f"READY: Blender={BLENDER}; FFmpeg={FFMPEG}; coin source={coin_movie}")
        print(f"Output directory: {output}")
        return
    if args.preview_coin_journey:
        render_transition_preview(output, coin_movie, args.resume)
        return
    if args.story_samples < 1 or args.groove_samples < 1:
        raise ValueError("Cycles sample counts must be positive.")
    render_full_story(
        output, coin_movie, args.resume, args.story_samples, args.groove_samples, args.assemble_only
    )


if __name__ == "__main__":
    main()
