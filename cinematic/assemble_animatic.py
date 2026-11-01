#!/usr/bin/env python3
"""Assemble the cue-locked director's cut from rendered frames and its effects bed."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

from frame_io import png_dimensions

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((Path(__file__).resolve().parent / "cues.json").read_text())
F, G = CUES["frames"], CUES["groove"]
OUT = ROOT / "build" / "cinematic-phase4"
DEFAULT_ASSEMBLY = OUT / "animatic"
FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


def build_video_graph(segment_counts, width, height, transition_frames):
    if len(segment_counts) < 2 or any(count <= transition_frames for count in segment_counts):
        raise ValueError("Every segment must be longer than the cue-preserving transition.")
    if transition_frames < 2:
        raise ValueError("Transitions need at least two frames.")

    graph = []
    for index, count in enumerate(segment_counts):
        graph.append(
            f"[{index}:v]trim=end_frame={count},setpts=PTS-STARTPTS,"
            f"scale={width}:{height}:flags=lanczos,fps=60,format=yuv420p,setsar=1,"
            f"settb=1/60,setpts=PTS-STARTPTS[s{index}]"
        )

    prior = "s0"
    prior_count = segment_counts[0]
    fraction = f"min(1,T*60/{transition_frames - 1})"
    for index, count in enumerate(segment_counts[1:], 1):
        hold = f"hold{index}"
        head = f"head{index}"
        blend = f"blend{index}"
        tail = f"tail{index}"
        transition_segment = f"segment{index}"
        output = f"out{index}"
        prior_hold_source = f"priorholdsource{index}"
        prior_keep_source = f"priorkeepsource{index}"
        next_head_source = f"headsource{index}"
        next_tail_source = f"tailsource{index}"
        graph.extend((
            f"[{prior}]split=2[{prior_hold_source}][{prior_keep_source}]",
            f"[{prior_hold_source}]trim=start_frame={prior_count - 1}:end_frame={prior_count},"
            f"settb=1/60,setpts=PTS-STARTPTS,loop=loop={transition_frames - 1}:size=1:start=0,"
            f"trim=end_frame={transition_frames},settb=1/60,setpts=PTS-STARTPTS[{hold}]",
            f"[s{index}]split=2[{next_head_source}][{next_tail_source}]",
            f"[{next_head_source}]trim=end_frame={transition_frames},settb=1/60,setpts=PTS-STARTPTS[{head}]",
            f"[{hold}][{head}]blend=all_expr='A*(1-{fraction})+B*{fraction}'[{blend}]",
            f"[{next_tail_source}]trim=start_frame={transition_frames},settb=1/60,setpts=PTS-STARTPTS[{tail}]",
            f"[{blend}][{tail}]concat=n=2:v=1:a=0,settb=1/60,setpts=PTS-STARTPTS[{transition_segment}]",
            f"[{prior_keep_source}][{transition_segment}]concat=n=2:v=1:a=0,settb=1/60,setpts=PTS-STARTPTS[{output}]",
        ))
        prior = output
        prior_count += count
    return ";".join(graph), f"[{prior}]", sum(segment_counts)


def run(command, args):
    subprocess.run([command, *map(str, args)], check=True)


def probe(path):
    result = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels",
         "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def verify_video(path, frame_count, width, height):
    info = probe(path)
    video = next((stream for stream in info["streams"] if stream["codec_type"] == "video"), None)
    audio = next((stream for stream in info["streams"] if stream["codec_type"] == "audio"), None)
    duration = float(info["format"]["duration"])
    expected_duration = frame_count / CUES["fps"]
    if (video is None or audio is None or video["codec_name"] != "h264" or audio["codec_name"] != "aac"
            or video["width"] != width or video["height"] != height
            or video["r_frame_rate"] != "60/1" or int(video["nb_frames"]) != frame_count
            or int(audio["sample_rate"]) != 48000 or int(audio["channels"]) != 2
            or abs(duration - expected_duration) > 1 / CUES["fps"]):
        raise RuntimeError(f"Encoded director's cut failed verification: {info}")


def validate_frames(directory, first, count, width, height):
    for frame in range(first, first + count):
        path = directory / f"frame_{frame:04d}.png"
        if png_dimensions(path) != (width, height):
            raise RuntimeError(f"Missing, corrupt or incorrectly sized render frame: {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--coin", type=Path, default=ROOT / "build" / "awakening-film.mp4")
    parser.add_argument("--story-frames", type=Path, default=OUT / "animatic" / "story")
    parser.add_argument("--wide-frames", type=Path, default=OUT / "groove" / "wideseq")
    parser.add_argument("--pullback-frames", type=Path, default=OUT / "groove" / "pullback")
    parser.add_argument("--effects", type=Path, default=OUT / "animatic" / "sfx-bed.wav")
    parser.add_argument("--song", type=Path, default=ROOT / "audio" / f"{CUES['opener']['trackId']}.mp3")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_ASSEMBLY)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--transition-frames", type=int, default=12)
    parser.add_argument("--no-review-mix", action="store_true")
    args = parser.parse_args()

    if not FFMPEG or not FFPROBE:
        raise RuntimeError("FFmpeg and FFprobe are required to assemble and verify the director's cut.")
    offset = F["stylusContact"] - G["contactFrame"]
    segments = (
        (["-i", args.coin], F["coinGone"], 0),
        (["-framerate", "60", "-start_number", F["coinGone"],
          "-i", args.story_frames / "frame_%04d.png"], F["toRecord"] - F["coinGone"], F["coinGone"]),
        (["-framerate", "60", "-start_number", 120,
          "-i", args.wide_frames / "frame_%04d.png"], F["stylusApproach"] - F["toRecord"], 120),
        (["-framerate", "60", "-start_number", F["stylusApproach"] - offset,
          "-i", args.pullback_frames / "frame_%04d.png"],
         F["final"] + 1 - F["stylusApproach"], F["stylusApproach"] - offset),
    )
    counts = [count for _, count, _ in segments]
    total = sum(counts)
    if total != F["final"] + 1 or F["final"] != 1154:
        raise RuntimeError(f"Director's cut frame contract changed unexpectedly: {total} frames.")
    if args.width <= 0 or args.height <= 0 or args.width * 9 != args.height * 16:
        raise ValueError("Output dimensions must be a positive 16:9 size.")

    validate_frames(args.story_frames, F["coinGone"], counts[1], args.width, args.height)
    validate_frames(args.wide_frames, 120, counts[2], args.width, args.height)
    validate_frames(args.pullback_frames, F["stylusApproach"] - offset, counts[3], args.width, args.height)
    for source in (args.coin, args.effects):
        if not source.is_file():
            raise FileNotFoundError(f"Required assembly source is missing: {source}")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    film = args.out_dir / "director-cut-master.mp4"
    staged_film = args.out_dir / ".director-cut-master.pending.mp4"
    graph, video_label, frame_count = build_video_graph(counts, args.width, args.height, args.transition_frames)
    inputs = []
    for source_args, _, _ in segments:
        inputs.extend(source_args)
    audio_index = len(segments)
    inputs.extend(("-i", args.effects))
    run(FFMPEG, (
        "-y", "-hide_banner", "-loglevel", "error", *inputs,
        "-filter_complex", graph, "-map", video_label, "-map", f"{audio_index}:a:0",
        "-frames:v", frame_count, "-t", f"{frame_count / CUES['fps']:.9f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high",
        "-level:v", "4.2", "-pix_fmt", "yuv420p", "-r", CUES["fps"],
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", staged_film,
    ))
    verify_video(staged_film, frame_count, args.width, args.height)
    os.replace(staged_film, film)

    if not args.no_review_mix:
        if not args.song.is_file():
            raise FileNotFoundError(f"Opening-song review source is missing: {args.song}")
        staged_mix = args.out_dir / ".director-cut-review-with-song.pending.mp4"
        mix = args.out_dir / "director-cut-review-with-song.mp4"
        delay_ms = round(CUES["song"]["startSec"] * 1000)
        run(FFMPEG, (
            "-y", "-hide_banner", "-loglevel", "error", "-i", film, "-i", args.song,
            "-filter_complex",
            f"[1:a]adelay={delay_ms}|{delay_ms},volume=0.8[s];"
            "[0:a][s]amix=inputs=2:normalize=0:duration=first[a]",
            "-map", "0:v:0", "-map", "[a]", "-t", f"{frame_count / CUES['fps']:.9f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", staged_mix,
        ))
        verify_video(staged_mix, frame_count, args.width, args.height)
        os.replace(staged_mix, mix)
        print(f"WROTE {mix}")

    print(f"WROTE {film}\n{frame_count} frames = {frame_count / CUES['fps']:.3f} s")
    print(f"Transitions: {args.transition_frames} frames at each rendered segment boundary; cue frames unchanged.")


if __name__ == "__main__":
    main()
