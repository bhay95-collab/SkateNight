import binascii
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import types
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cinematic"))
from assemble_animatic import build_video_graph
from frame_io import png_dimensions, render_frame_sequence
from render_production import validate_coin_movie_info


def png_chunk(kind, payload):
    return (
        struct.pack(">I", len(payload)) + kind + payload
        + struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF)
    )


def write_png(path, width=2, height=1):
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    pixels = b"".join(b"\0" + b"\x7f\x7f\x7f\xff" * width for _ in range(height))
    data = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
    data += png_chunk(b"IDAT", zlib.compress(pixels)) + png_chunk(b"IEND", b"")
    Path(path).write_bytes(data)


class RenderPipelineTests(unittest.TestCase):
    def test_png_validation_checks_dimensions_and_chunk_crc(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "frame.png"
            write_png(path)
            self.assertEqual(png_dimensions(path), (2, 1))
            corrupt = bytearray(path.read_bytes())
            corrupt[-5] ^= 0x01
            path.write_bytes(corrupt)
            self.assertIsNone(png_dimensions(path))
            self.assertIsNone(png_dimensions(Path(directory) / "missing.png"))

    def test_resume_reuses_only_valid_frames_and_renders_corrupt_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            scene = types.SimpleNamespace(
                render=types.SimpleNamespace(filepath="original"),
                timeline_markers=[],
                frame_set=lambda frame: None,
            )
            renders = []

            def render(write_still):
                renders.append(scene.render.filepath)
                write_png(scene.render.filepath)

            blender = types.SimpleNamespace(ops=types.SimpleNamespace(
                render=types.SimpleNamespace(render=render),
            ))
            with patch.dict(sys.modules, {"bpy": blender}):
                render_frame_sequence(scene, directory, 1, 2, 2, 1)
                render_frame_sequence(scene, directory, 1, 2, 2, 1, resume=True)
                self.assertEqual(len(renders), 2)
                (Path(directory) / "frame_0002.png").write_bytes(b"corrupt")
                render_frame_sequence(scene, directory, 1, 2, 2, 1, resume=True)
                self.assertEqual(len(renders), 3)
                self.assertEqual(scene.render.filepath, "original")
                with self.assertRaises(FileExistsError):
                    render_frame_sequence(scene, directory, 1, 1, 2, 1)

    def test_segment_transitions_preserve_all_cue_frame_positions(self):
        graph, output, frame_count = build_video_graph((186, 673, 27, 269), 1920, 1080, 12)
        self.assertEqual(frame_count, 1155)
        self.assertEqual(output, "[out3]")
        self.assertEqual(graph.count("blend=all_expr="), 3)
        self.assertIn("trim=start_frame=885:end_frame=886", graph)
        self.assertIn(
            "[priorkeepsource3][segment3]concat=n=2:v=1:a=0,"
            "settb=1/60,setpts=PTS-STARTPTS[out3]",
            graph,
        )
        with self.assertRaises(ValueError):
            build_video_graph((8, 8), 1920, 1080, 12)

    def test_preflight_rejects_incompatible_coin_source_media(self):
        valid = {
            "streams": [
                {"codec_type": "video", "width": 1920, "height": 1080,
                 "r_frame_rate": "60/1", "nb_frames": "1093"},
                {"codec_type": "audio"},
            ],
        }
        video = validate_coin_movie_info(valid, "coin.mp4")
        self.assertEqual(video["width"], 1920)
        for invalid in (
            {**valid, "streams": [dict(valid["streams"][0], width=1280), valid["streams"][1]]},
            {**valid, "streams": [dict(valid["streams"][0], r_frame_rate="30/1"), valid["streams"][1]]},
            {**valid, "streams": [dict(valid["streams"][0], nb_frames="100"), valid["streams"][1]]},
            {**valid, "streams": [dict(valid["streams"][0], nb_frames=None), valid["streams"][1]]},
            {**valid, "streams": valid["streams"][:1]},
        ):
            with self.subTest(streams=invalid["streams"]), self.assertRaises(RuntimeError):
                validate_coin_movie_info(invalid, "coin.mp4")

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg/FFprobe are required")
    def test_ffmpeg_crossfades_retain_every_source_frame(self):
        counts = (20, 24, 28)
        graph, output, frame_count = build_video_graph(counts, 320, 180, 4)
        with tempfile.TemporaryDirectory() as directory:
            movie = Path(directory) / "transition-test.mp4"
            command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
            for color, count in zip(("red", "green", "blue"), counts):
                command.extend((
                    "-f", "lavfi", "-i",
                    f"color=c={color}:s=320x180:r=60:d={count / 60:.9f}",
                ))
            command.extend((
                "-filter_complex", graph, "-map", output, "-frames:v", str(frame_count),
                "-r", "60", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(movie),
            ))
            subprocess.run(command, check=True)
            result = subprocess.run(
                (
                    "ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=nb_frames,r_frame_rate", "-of", "json", str(movie),
                ),
                check=True, capture_output=True, text=True,
            )
            video = json.loads(result.stdout)["streams"][0]
            self.assertEqual(int(video["nb_frames"]), frame_count)
            self.assertEqual(video["r_frame_rate"], "60/1")


if __name__ == "__main__":
    unittest.main()
