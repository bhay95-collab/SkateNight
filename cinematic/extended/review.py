#!/usr/bin/env python3
"""Build a local review package and qualified spot-based render estimate.

CPU/FFmpeg only. Existing review packages are preserved; choose a fresh output
directory. Run --cost-only before the complete development movie is available.
"""
import argparse
import hashlib
import html
import json
import math
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from frame_io import png_dimensions
from timeline import CUES, FPS, FRAME_COUNT, MANIFEST, manifest_sha256


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-of',
                             'json', str(path)], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def frame(cue):
    return math.floor(CUES[cue] * FPS + .5)


def cost_model(quality_root, supplements=()):
    """Use measured 1080p final-sample rows, with explicit sparse phase fallbacks."""
    reports = {}
    for shot in ('story', 'changer', 'vinyl'):
        expected_samples = 128 if shot == 'story' else 96
        measured = {}
        setup_seconds = 0
        # Supplements retain their real paths. The primary root wins if the
        # same frame has a later corrective measurement; nothing is relabelled.
        for root in (*supplements, quality_root):
            path = root / shot / f'render-{shot}.json'
            if not path.is_file():
                continue
            report = read(path)
            if report.get('validate_only') is True:
                continue
            if (report['width'], report['height'], report['samples'], report['engine']) != (1920, 1080, expected_samples, 'cycles'):
                raise ValueError(f'Cost sample is not final-quality 1080p Cycles: {path}')
            setup_seconds += report.get('setup_seconds', 0)
            for i, row in enumerate(report['frames']):
                image = path.parent / f"frame_{row['frame']:04d}.png"
                if (row.get('wall_seconds', 0) > 0 and row.get('bytes', 0) > 0
                        and png_dimensions(image) == (1920, 1080)):
                    measured[row['frame']] = dict(row, report=str(path), image=str(image), process_first=(i == 0))
        if not measured:
            raise ValueError(f'No measured valid 1080p pixel render timings for {shot}')
        reports[shot] = {'setup_seconds': setup_seconds, 'rows': list(measured.values())}
    shots = {shot['id']: shot for shot in MANIFEST['shots']}
    vstart, vend = shots['vinyl']['start'], shots['vinyl']['end']
    # The 18-frame mixed LOD interval is deliberately separate: two surfaces
    # coexist there and a single average for all vinyl would hide its cost.
    groups = [('story', 93, 404, 'story'), ('changer', 405, 605, 'changer'),
              ('vinyl descent', vstart, frame('canyonFlight') - 1, 'vinyl'),
              ('groove flight', frame('canyonFlight'), frame('grooveExit') - 1, 'vinyl'),
              ('groove exit before LOD', frame('grooveExit'), 849, 'vinyl'),
              ('LOD surface blend', 850, 867, 'vinyl'),
              ('groove exit after LOD', 868, frame('stylusApproach') - 1, 'vinyl'),
              ('C1 approach and contact', frame('stylusApproach'), vend, 'vinyl')]
    result = []
    for name, lo, hi, shot in groups:
        rows = [r for r in reports[shot]['rows'] if lo <= r['frame'] <= hi]
        fallback = not rows
        if fallback:
            midpoint = (lo + hi) / 2
            rows = [min(reports[shot]['rows'], key=lambda r: abs(r['frame'] - midpoint))]
        times = [r['wall_seconds'] for r in rows]
        count = hi - lo + 1
        result.append({'phase': name, 'start': lo, 'end': hi, 'frames': count,
                       'sample_frames': [r['frame'] for r in rows],
                       'borrowed_nearest_phase_sample': fallback,
                       'mean_seconds_per_frame': sum(times) / len(times),
                       'estimated_seconds': count * sum(times) / len(times),
                       'planning_low_seconds': count * min(times) * .75,
                       'planning_high_seconds': count * max(times) * 1.5,
                       'samples': rows})
    total = sum(row['estimated_seconds'] for row in result)
    return {'status': 'Measured spot extrapolation; full render has not been timed',
            'timeline_sha256': manifest_sha256(), 'fps': FPS, 'frame_count': FRAME_COUNT,
            'browser_frames': shots['cabinet']['end'] - shots['cabinet']['start'] + 1,
            'blender_frames': sum(row['frames'] for row in result), 'phases': result,
            'blender_estimate_hours': total / 3600,
            'planning_low_hours': sum(r['planning_low_seconds'] for r in result) / 3600,
            'planning_high_hours': sum(r['planning_high_seconds'] for r in result) / 3600,
            'setup_seconds': sum(r['setup_seconds'] for r in reports.values()),
            'peak_observed_process_rss_gib': max(r['peak_rss_bytes'] for v in reports.values() for r in v['rows']) / 1024 ** 3,
            'qualifications': [
                'Browser capture, assembly, audio, validation, restarts and overnight thermal changes are excluded from Blender hours.',
                'First measured frame in each process includes possible cold Metal/kernel/cache work; later rows are warm candidates, not controlled cold/warm benchmarks.',
                'Each phase uses its measured mean, or an explicitly marked nearest-phase fallback. Sparse spots cannot establish a statistical confidence interval.',
                'Planning range is 75% of each phase minimum to 150% of its maximum; this is a stated budgeting allowance, not measured error bars.',
                'The 18-frame 850..867 LOD blend is weighted separately. Low-resolution preview timings are not scaled into the final-quality estimate.',
                'macOS process peak RSS is cumulative within a process and does not measure all Metal/unified GPU allocations.',
                'The earlier 19-hour study estimate used different geometry and must not be treated as this build’s measured duration.'
            ]}


def cost_text(model):
    lines = ['# Native-30 render cost from final-quality spots', '',
             f"Blender point estimate: **{model['blender_estimate_hours']:.2f} hours**; planning allowance **{model['planning_low_hours']:.2f}–{model['planning_high_hours']:.2f} hours**.", '',
             '93 native browser frames are outside these Blender hours. The estimate weights 312 story, 201 changer and 444 vinyl frames.', '',
             '| Phase | Frames | Measured frame(s) | Seconds/frame | Hours |',
             '|---|---:|---|---:|---:|']
    for row in model['phases']:
        sample = ', '.join(map(str, row['sample_frames'])) + (' (borrowed)' if row['borrowed_nearest_phase_sample'] else '')
        lines.append(f"| {row['phase']} | {row['frames']} | {sample} | {row['mean_seconds_per_frame']:.2f} | {row['estimated_seconds']/3600:.2f} |")
    lines += ['', f"Observed process peak RSS: {model['peak_observed_process_rss_gib']:.2f} GiB.", '']
    lines += ['- ' + item for item in model['qualifications']]
    return '\n'.join(lines) + '\n'


def relative(path, output):
    return html.escape(Path(os.path.relpath(path, output)).as_posix(), quote=True)


def clip(movie, output, lo, hi):
    count = hi - lo + 1
    temporary = output.with_name('.' + output.stem + '.pending.mp4')
    try:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(movie),
                        '-vf', f'trim=start_frame={lo}:end_frame={hi+1},setpts=PTS-STARTPTS',
                        '-af', f'atrim=start={lo/FPS}:end={(hi+1)/FPS},asetpts=PTS-STARTPTS',
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                        '-fps_mode', 'passthrough', '-c:a', 'aac', '-ar', '48000', '-ac', '2',
                        '-movflags', '+faststart', str(temporary)], check=True)
        video = next(s for s in probe(temporary)['streams'] if s['codec_type'] == 'video')
        if int(video.get('nb_frames', 0)) != count or video['r_frame_rate'] != '30/1':
            raise RuntimeError(f'Clip changed native frame count/rate: {output}')
        os.link(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    return {'file': str(output), 'source_start_frame': lo, 'source_end_frame': hi,
            'frames': count, 'duration_seconds': count / FPS, 'sha256': digest(output)}


def build(render_root, export_root, quality_root, output, evidence_dirs, cost_only=False, supplements=()):
    if output.exists():
        raise FileExistsError(f'Existing review preserved: {output}; choose a fresh version directory')
    model = cost_model(quality_root, supplements)
    output.mkdir(parents=True)
    (output / 'render-cost.json').write_text(json.dumps(model, indent=2) + '\n')
    (output / 'render-cost.md').write_text(cost_text(model))
    if cost_only:
        return
    report_path = export_root / 'assembled/assembly-report.json'
    report = read(report_path)
    if report.get('synthetic_fixture') or report.get('timeline_sha256') != manifest_sha256():
        raise ValueError('Review requires a current, non-synthetic assembly report')
    effects = Path(report['effects_movie'])
    song = Path(report['review_movie'])
    for movie, key in ((effects, 'effects_sha256'), (song, 'review_sha256')):
        if digest(movie) != report[key]:
            raise ValueError(f'Assembled movie checksum mismatch: {movie}')
        video = next(s for s in probe(movie)['streams'] if s['codec_type'] == 'video')
        if int(video.get('nb_frames', 0)) != FRAME_COUNT or video['r_frame_rate'] != '30/1':
            raise ValueError('Full review must preserve all 1050 native-30 frames')
    manifest = read(effects.with_suffix('.mp4.json'))
    if manifest.get('audioOwnership', {}).get('songEmbedded') is not False:
        raise ValueError('Effects movie must leave opening-song ownership with the jukebox')
    clips = []
    for name, lo, hi in [('carousel', frame('carousel'), 605),
                         ('groove-world', frame('grooveDescent'), frame('stylusApproach') - 1),
                         ('groove-exit-to-stylus', frame('grooveExit'), frame('stylusContact')),
                         ('C1-contact-and-registration', frame('stylusApproach'), FRAME_COUNT - 1)]:
        clips.append(clip(song, output / (name + '.mp4'), lo, hi))
    def link(path, label):
        return f'<a href="{relative(path, output)}">{html.escape(label)}</a>'
    def video(path, caption):
        return f'<figure><video controls preload="metadata" src="{relative(path, output)}"></video><figcaption>{html.escape(caption)}</figcaption></figure>'
    body = ['<h1>The Song Inside</h1><p class="status">35 seconds · native 30 fps · unapproved production development</p>',
            '<p>Review the full cut with the opening song below. The separate effects-only movie owns the cinematic sound bed; the jukebox owns Praise Lifted On High. A song-containing review must never be imported as the application film.</p>',
            video(song, 'Full 35-second review with song — 1,050 native frames'),
            '<p>' + link(effects, 'Effects-only movie') + ' · ' + link(effects.with_suffix('.mp4.json'), 'Effects movie manifest') + ' · ' + link(report_path, 'Assembly checksums') + '</p>',
            '<h2>Shot reviews</h2>']
    for item in clips:
        body.append(video(Path(item['file']), f"{Path(item['file']).stem} · source {item['source_start_frame']}..{item['source_end_frame']} · {item['frames']} frames · {item['duration_seconds']:.3f}s"))
    body += ['<h2>Sound and evidence</h2>']
    for path, label in [(render_root / 'audio/effects-only.wav', '35-second effects-only PCM WAV'),
                        (render_root / 'audio/review-with-song.wav', '35-second song review PCM WAV'),
                        (render_root / 'audio/audio-report.json', 'Audio loudness, peaks and sample positions'),
                        (output / 'render-cost.md', 'Measured render estimate and uncertainty'),
                        (render_root / 'preflight.json', 'Production preflight')]:
        body.append('<p>' + link(path, label) + '</p>')
    proxy = export_root / 'technical-integration/awakening-35-1080-DEVELOPMENT-PROXY.mp4'
    if proxy.exists():
        body.append('<p>' + link(proxy, '1080p application integration proxy') + ' — spatial enlargement of the development movie; no new temporal frames and no final 1080p rendering.</p>')
    for directory in evidence_dirs:
        body.append('<p>' + link(directory, 'Application test evidence: ' + directory.name) + '</p>')
    body += ['<h2>Final-resolution spot renders</h2><p>1920×1080 Cycles spots show selected frames only. They do not establish quality or continuity of a complete final-resolution film.</p>']
    selected_images = {}
    for phase in model['phases']:
        for sample in phase['samples']:
            selected_images[sample['image']] = sample['report']
    for image_name, report_name in selected_images.items():
        image = Path(image_name)
        href = relative(image, output)
        body.append(f'<figure><a href="{href}"><img loading="lazy" src="{href}" alt="{html.escape(image.stem)}"></a><figcaption>{html.escape(image.parent.name)} {image.stem} · {link(Path(report_name), "settings and measured time")}</figcaption></figure>')
    body += ['<h2>Listening and acceptance checks</h2><ul><li>Hear the failed ignition and its deliberate quiet gap, then the recovery pulses and drive progression.</li><li>Check the descent and groove world at normal playback level; listen for harsh resonances and repetitive noise.</li><li>Hear one opening song. Its first hit belongs at contact, frame 948 / 31.6 seconds; the song starts at 31.393 seconds.</li><li>Check the final registration, final-frame exposure, transport release and song continuity in the actual application.</li><li>Inspect the complete final-resolution render and calibrate projector/PA latency on venue hardware before promotion.</li></ul>']
    css = 'body{font:16px/1.55 system-ui,sans-serif;background:#151310;color:#eee6d7;max-width:1100px;margin:40px auto;padding:0 24px}h1{font-size:48px;margin-bottom:0}h2{margin-top:44px}a{color:#efbc72}video,img{width:100%;height:auto;background:#000}figure{margin:24px 0}figcaption,.status{color:#c9bca5}li{margin:12px 0}'
    (output / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Song Inside — production review</title><style>' + css + '</style><body>' + '\n'.join(body) + '</body></html>')
    (output / 'review-report.json').write_text(json.dumps({'status': 'unapproved development review', 'assembly_report': str(report_path), 'timeline_sha256': manifest_sha256(), 'clips': clips, 'source_effects_sha256': report['effects_sha256'], 'source_review_sha256': report['review_sha256']}, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render-root', type=Path, required=True)
    parser.add_argument('--export-root', type=Path, help='Defaults to render root')
    parser.add_argument('--quality-root', type=Path, required=True)
    parser.add_argument('--supplement-quality-root', type=Path, action='append', default=[],
                        help='Older unchanged spots at their real paths; primary quality root wins duplicate frames')
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--evidence-dir', type=Path, action='append', default=[])
    parser.add_argument('--cost-only', action='store_true')
    args = parser.parse_args()
    build(args.render_root.resolve(), (args.export_root or args.render_root).resolve(),
          args.quality_root.resolve(), args.output_dir.resolve(),
          [p.resolve() for p in args.evidence_dir], args.cost_only,
          [p.resolve() for p in args.supplement_quality_root])
