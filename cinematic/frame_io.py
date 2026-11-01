"""Safe PNG frame validation and resumable Blender frame rendering."""
import binascii
import os
import struct
from pathlib import Path

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_dimensions(path):
    """Return PNG dimensions only when every chunk checksum and the end marker validate."""
    path = Path(path)
    try:
        data = path.read_bytes()
    except FileNotFoundError:
        return None
    if not data.startswith(PNG_SIGNATURE):
        return None

    offset = len(PNG_SIGNATURE)
    dimensions = None
    saw_end = False
    while offset < len(data):
        if offset + 12 > len(data):
            return None
        length = struct.unpack_from(">I", data, offset)[0]
        chunk_end = offset + 12 + length
        if chunk_end > len(data):
            return None
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        expected_crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        if binascii.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            return None
        if offset == len(PNG_SIGNATURE):
            if kind != b"IHDR" or length != 13:
                return None
            dimensions = struct.unpack_from(">II", payload)
        if kind == b"IEND":
            if length != 0:
                return None
            saw_end = True
            offset = chunk_end
            break
        offset = chunk_end

    return dimensions if saw_end and offset == len(data) else None


def render_frame_sequence(scene, output_dir, start, end, width, height, resume=False, frame_setup=None):
    """Render a numbered PNG sequence, atomically replacing only missing or invalid frames."""
    import bpy

    if start < 0 or end < start or width <= 0 or height <= 0:
        raise ValueError("Frame range and render dimensions must be positive and ordered.")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    original_filepath = scene.render.filepath
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.frame_start, scene.frame_end = start, end
    markers = sorted(
        ((marker.frame, marker.camera) for marker in scene.timeline_markers if marker.camera),
        key=lambda item: item[0],
    )
    rendered = skipped = 0

    try:
        for frame in range(start, end + 1):
            target = output_dir / f"frame_{frame:04d}.png"
            existing_dimensions = png_dimensions(target)
            if existing_dimensions == (width, height):
                if resume:
                    skipped += 1
                    continue
                raise FileExistsError(f"{target} already exists; use --resume to preserve valid frames.")
            if target.exists() and not resume:
                raise RuntimeError(f"{target} is invalid; use --resume to re-render it safely.")

            camera_marker = next((camera for marker_frame, camera in reversed(markers)
                                  if marker_frame <= frame), None)
            if camera_marker is not None:
                scene.camera = camera_marker
            scene.frame_set(frame)
            if frame_setup is not None:
                frame_setup(scene, frame)
            temporary = output_dir / f".frame_{frame:04d}.{os.getpid()}.pending.png"
            scene.render.filepath = str(temporary)
            print(f"RENDER frame {frame}/{end}", flush=True)
            try:
                bpy.ops.render.render(write_still=True)
                if png_dimensions(temporary) != (width, height):
                    raise RuntimeError(f"Blender produced an invalid {width}x{height} PNG for frame {frame}.")
                os.replace(temporary, target)
            finally:
                if temporary.exists():
                    temporary.unlink()
            rendered += 1
    finally:
        scene.render.filepath = original_filepath

    print(f"FRAME SEQUENCE complete: {rendered} rendered, {skipped} validated and reused.", flush=True)
