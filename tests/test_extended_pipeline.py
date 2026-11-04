"""Contract, stale-resume and actual FFmpeg assembly checks for the new film."""
import importlib.util
import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest
import wave
import zlib
from pathlib import Path
from unittest import mock

HERE=Path(__file__).resolve().parents[1]/'cinematic/extended'
sys.path.insert(0,str(HERE))
import timeline
_spec=importlib.util.spec_from_file_location('test_extended_production_pipeline',HERE/'render_production.py')
production=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(production)
import assemble


def png(width=32,height=18):
    def chunk(kind,payload):
        return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))
            +chunk(b'IDAT',zlib.compress((b'\x00'+b'\x18\x30\x48'*width)*height))+chunk(b'IEND',b''))


class TimelineTests(unittest.TestCase):
    def test_coverage_sampling_and_sample_accurate_song(self):
        shots=[timeline.shot_for_frame(f) for f in range(1050)]
        self.assertEqual([shots.count(s) for s in ('cabinet','story','changer','vinyl')],[93,312,201,444])
        self.assertEqual(timeline.FRAMES['stylusContact'],948)
        self.assertEqual(timeline.FRAMES['registrationStart'],1028)
        self.assertEqual(timeline.FRAMES['coinImpact'],158)
        self.assertEqual(timeline.AUDIO['coinImpact'],5.25)
        self.assertEqual(round((timeline.AUDIO['songPlayback']+.207)*48000),1516800)
        self.assertEqual(timeline.source_frame_for_c1(915),175)
        self.assertEqual(timeline.source_frame_for_c1(947),239)
        self.assertEqual(timeline.source_frame_for_c1(948),240)
        self.assertEqual(timeline.source_frame_for_c1(1048),440)
        self.assertEqual(timeline.source_frame_for_c1(1049),443)
        self.assertEqual((1050-948)/30,3.4)
        with self.assertRaises(ValueError):timeline.shot_for_frame(1050)

    def test_no_gap_or_overlap_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'cues.json'
            bad=json.loads(timeline.MANIFEST_PATH.read_text());bad['shots'][1]['start']=92
            path.write_text(json.dumps(bad))
            with self.assertRaises(ValueError):timeline.load_manifest(path)

    def test_tampered_timing_fails_load_and_preflight_before_tools(self):
        cases=[('cues','stylusContact',31.7),('audio','songPlayback',31.2),('audio','firstHit',31.7),
               ('cues','final',34.95),('c1','approach_frames',32),('c1','landing_frames',101),
               ('c1','source_fps',30),('c1','final_source_frame',442),
               ('cues','failure',7.0),('cues','heartbeats',[10.4,9.6]),
               ('cues','heartbeats',[float('nan')]),('cues','grooveExit',float('inf')),
               ('cues','transmission',13.6),
               (None,'version','production-preview-35s-native30-v2'),
               (None,'schema_version',2),(None,'schema_version',True),
               (None,'film_kind','awakening'),(None,'experimental',1)]
        for name,value in [('cx',.5),('cy',.5),('r',.1),('cssAngleDeg',0),('rpm',60),
                           ('r','0.047135416666666666'),('r',None),('rpm',True),
                           ('r',float('nan')),('cssAngleDeg',float('inf'))]:
            record={**timeline.MANIFEST['c1']['record'],name:value}
            cases.append(('c1','record',record))
        cases.append(('c1','record',None))
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'cues.json'
            for section,name,value in cases:
                with self.subTest(section=section,name=name,value=value):
                    bad=json.loads(timeline.MANIFEST_PATH.read_text())
                    (bad if section is None else bad[section])[name]=value
                    path.write_text(json.dumps(bad))
                    with self.assertRaises(ValueError):timeline.load_manifest(path)
                    with mock.patch.object(production,'load_manifest',side_effect=lambda:timeline.load_manifest(path)),mock.patch.object(production,'browser_dependencies') as browser:
                        with self.assertRaises(ValueError):production.preflight(Path(temp),Path(temp),metal=False)
                        browser.assert_not_called()
            # Minor camera-development metadata is deliberately unconstrained.
            valid=json.loads(timeline.MANIFEST_PATH.read_text());valid['camera_notes']={'bank':.012,'focus_override':'artist'}
            path.write_text(json.dumps(valid));self.assertEqual(timeline.load_manifest(path)['camera_notes'],valid['camera_notes'])


class ResumeTests(unittest.TestCase):
    def test_content_fingerprint_changes_without_mtime_or_git_change(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'cinematic').mkdir()
            scene=root/'cinematic/scene.py';scene.write_text('A')
            (root/'build/cinematic-phase4').mkdir(parents=True);(root/'audio').mkdir()
            (root/'covers').mkdir();(root/'rfai-logo.png').write_bytes(b'logo');(root/'covers/vol-iv.jpg').write_bytes(b'label')
            for rel in ('build/awakening-film.mp4','build/cinematic-phase4/ui-plate.png','audio/praise-lifted-on-high.mp3'):(root/rel).write_bytes(b'asset')
            old_time=scene.stat().st_mtime_ns
            result=mock.Mock(stdout=b'')
            with mock.patch.object(production,'ROOT',root),mock.patch.object(production.subprocess,'run',return_value=result):
                first=production.source_fingerprint(root,{'samples':8})
                scene.write_text('B');os.utime(scene,ns=(old_time,old_time))
                second=production.source_fingerprint(root,{'samples':8})
                third=production.source_fingerprint(root,{'samples':16})
            self.assertNotEqual(first['sha256'],second['sha256'])
            self.assertNotEqual(second['sha256'],third['sha256'])

    def test_external_assets_are_hashed_at_actual_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'code';assets=Path(temp)/'external'
            (root/'cinematic').mkdir(parents=True);(assets/'covers').mkdir(parents=True)
            (assets/'fonts').mkdir();(assets/'build/cinematic-phase4').mkdir(parents=True);(assets/'audio').mkdir()
            for rel in ('rfai-logo.png','covers/vol-iv.jpg','fonts/actual.woff2','build/awakening-film.mp4','build/cinematic-phase4/ui-plate.png','audio/praise-lifted-on-high.mp3'):(assets/rel).write_bytes(b'original')
            with mock.patch.object(production,'ROOT',root),mock.patch.object(production,'tracked_browser_assets',return_value=[]),mock.patch.object(production.subprocess,'run',return_value=mock.Mock(stdout=b'')):
                first=production.source_fingerprint(assets,{})
                for rel in ('rfai-logo.png','covers/vol-iv.jpg','fonts/actual.woff2'):
                    target=assets/rel;target.write_bytes(b'changed')
                    self.assertNotEqual(first['sha256'],production.source_fingerprint(assets,{})['sha256'])
                    target.write_bytes(b'original')


class DependencyTests(unittest.TestCase):
    def test_preflight_rejects_missing_browser_overrides_without_launch(self):
        with mock.patch.dict(os.environ,{'CHROME_PATH':'/missing/chrome'}):
            with self.assertRaises(FileNotFoundError):production.browser_dependencies()
        with mock.patch.dict(os.environ,{'CHROME_PATH':sys.executable,'PLAYWRIGHT_CORE_PATH':'/missing/playwright.mjs'}):
            with self.assertRaises(FileNotFoundError):production.browser_dependencies()
        with tempfile.TemporaryDirectory() as temp:
            invalid=Path(temp)/'playwright.mjs';invalid.write_text('export const unrelated = true;')
            with mock.patch.dict(os.environ,{'CHROME_PATH':sys.executable,'PLAYWRIGHT_CORE_PATH':str(invalid)}):
                with self.assertRaises(RuntimeError):production.browser_dependencies()

    def test_preflight_rejects_missing_actual_label_texture(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'build/cinematic-phase4').mkdir(parents=True);(root/'audio').mkdir()
            for rel in ('build/awakening-film.mp4','build/cinematic-phase4/ui-plate.png','audio/praise-lifted-on-high.mp3','rfai-logo.png'):(root/rel).write_bytes(b'asset')
            with mock.patch.object(production,'browser_dependencies',return_value={}),mock.patch.object(production,'tracked_browser_assets',return_value=[]):
                with self.assertRaises(FileNotFoundError):production.preflight(root,root,metal=False)

    def test_audio_current_code_and_media_dependencies_are_required(self):
        audio=assemble._audio
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);code=root/'code/extended';code.mkdir(parents=True)
            assets=root/'assets';(assets/'build').mkdir(parents=True);(assets/'audio').mkdir()
            paths=[code/'audio.py',code/'timeline.py',code/'cues.json',code.parent/'sound_bed.py',code.parent/'cues.json',assets/'build/awakening-film.mp4',assets/'audio/praise-lifted-on-high.mp3']
            for p in paths:p.write_bytes(b'original')
            for name in ('effects-only.wav','review-with-song.wav'):(root/name).write_bytes(b'output')
            with mock.patch.object(audio,'HERE',code),mock.patch.object(audio.voices,'__file__',str(code.parent/'sound_bed.py')):
                report={'assets_root':str(assets),'dependency_hashes':audio.dependency_hashes(assets),'manifest_sha256':timeline.manifest_sha256(),'effects_only':True,'effects_sha256':audio.digest(root/'effects-only.wav'),'review_sha256':audio.digest(root/'review-with-song.wav')}
                audio.validate_report(report,root)
                for path in paths:
                    path.write_bytes(b'changed')
                    with self.assertRaises(RuntimeError):audio.validate_report(report,root)
                    path.write_bytes(b'original')

    def test_stale_refused_and_corrupt_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp)
            fingerprint={'sha256':'a'}
            production.ensure_render_state(directory,fingerprint,False)
            frame=directory/'frame_0000.png';frame.write_bytes(png())
            production.ensure_render_state(directory,fingerprint,True)
            production.validate_frames(directory,0,0,32,18)
            with self.assertRaises(RuntimeError):production.ensure_render_state(directory,{'sha256':'b'},True)
            with self.assertRaises(FileExistsError):production.ensure_render_state(directory,fingerprint,False)
            data=bytearray(frame.read_bytes());data[45]^=1;frame.write_bytes(data)
            with self.assertRaises(RuntimeError):production.validate_frames(directory,0,0,32,18)
            frame.unlink()
            with self.assertRaises(RuntimeError):production.validate_frames(directory,0,0,32,18)

    def test_atomic_renderer_recovers_corrupt_and_missing_preserves_valid(self):
        import frame_io
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);valid=directory/'frame_0000.png';valid.write_bytes(png())
            (directory/'frame_0001.png').write_bytes(b'corrupt')
            scene=mock.Mock();scene.timeline_markers=[];scene.render.filepath='prior'
            rendered=[]
            def render(**kwargs):
                rendered.append(scene.frame_set.call_args.args[0]);Path(scene.render.filepath).write_bytes(png())
            bpy=mock.Mock();bpy.ops.render.render.side_effect=render
            with mock.patch.dict(sys.modules,{'bpy':bpy}):frame_io.render_frame_sequence(scene,directory,0,2,32,18,True)
            self.assertEqual(rendered,[1,2]);self.assertEqual(valid.read_bytes(),png())
            production.validate_frames(directory,0,2,32,18)
            self.assertEqual(scene.render.filepath,'prior')
            self.assertFalse(list(directory.glob('*.pending.png')))


class AssemblyTests(unittest.TestCase):
    def test_real_ffmpeg_1050_native_frames_and_effects_contract(self):
        import shutil
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):self.skipTest('FFmpeg required')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source.png';source.write_bytes(png())
            for shot in timeline.MANIFEST['shots']:
                target=root/'frames'/shot['id'];target.mkdir(parents=True)
                for f in range(shot['start'],shot['end']+1):os.link(source,target/f'frame_{f:04d}.png')
                proof={'schema':1,'synthetic_fixture':True,'settings':{'width':32,'height':18,'fps':30,'shot':shot['id']},
                       'files':{str(source):production.sha256(source)}}
                proof['sha256']=hashlib.sha256(json.dumps(proof,sort_keys=True,separators=(',',':')).encode()).hexdigest()
                production.atomic_json(target/'render-state.json',proof)
            audio=root/'audio';audio.mkdir()
            for name in ('effects-only.wav','review-with-song.wav'):
                with wave.open(str(audio/name),'wb') as w:
                    w.setnchannels(2);w.setsampwidth(2);w.setframerate(48000);w.writeframes(b'\0'*1680000*4)
            production.atomic_json(audio/'audio-report.json',{'synthetic_fixture':True,'manifest_sha256':timeline.manifest_sha256(),'effects_only':True,
                                   'effects_sha256':production.sha256(audio/'effects-only.wav'),
                                   'review_sha256':production.sha256(audio/'review-with-song.wav')})
            with self.assertRaises(RuntimeError):assemble.assemble(root,32,18)
            manifest=assemble.assemble(root,32,18,synthetic_fixture=True)
            self.assertEqual(manifest['fps'],30);self.assertEqual(manifest['frameCount'],1050)
            self.assertEqual(manifest['audioOwnership']['songEmbedded'],False)
            self.assertEqual(manifest['handoff']['songStartSec'],31.393)
            self.assertFalse(manifest['applicationImportable'])
            # Real validator accepts the same contract at its required 1080p size.
            manifest.update(width=1920,height=1080,applicationImportable=True)
            script="import {validateAwakeningFilmManifest} from './awakening-film.js'; let m=JSON.parse(process.argv[1]);validateAwakeningFilmManifest(m,'production-preview');m.audioOwnership.songEmbedded=true;try{validateAwakeningFilmManifest(m,'production-preview');process.exit(2)}catch{}"
            subprocess.run(['node','--input-type=module','-e',script,json.dumps(manifest)],cwd=HERE.parents[1],check=True)
            self.assertFalse(list((root/'assembled').glob('.assembly-*')))
            self.assertFalse((root/'assembled/awakening-35-REVIEW-WITH-SONG.mp4.json').exists())
            proxy=assemble.package_proxy(root/'assembled/awakening-35-effects-only.mp4',root/'technical-integration')
            self.assertEqual(proxy['qualityTier'],'development-proxy')
            self.assertEqual(proxy['proxySource']['width'],32)
            self.assertEqual(proxy['proxySource']['height'],18)
            self.assertFalse(proxy['audioOwnership']['songEmbedded'])
            self.assertEqual(proxy['frameCount'],1050)
            preserved={p:(production.sha256(p),p.stat().st_mtime_ns) for p in list((root/'assembled').iterdir())+list((root/'technical-integration').iterdir())}
            with self.assertRaises(FileExistsError):assemble.assemble(root,32,18,synthetic_fixture=True)
            with self.assertRaises(FileExistsError):assemble.package_proxy(root/'assembled/awakening-35-effects-only.mp4',root/'technical-integration')
            with self.assertRaises(FileExistsError):assemble.encode(root,audio/'effects-only.wav',root/'assembled/awakening-35-effects-only.mp4',32,18)
            with self.assertRaises(FileExistsError):production.new_json(root/'assembled/assembly-report.json',{'replacement':True})
            self.assertEqual(preserved,{p:(production.sha256(p),p.stat().st_mtime_ns) for p in preserved})
            fresh=root/'exports-v2'
            assemble.assemble(root,32,18,synthetic_fixture=True,export_root=fresh)
            self.assertTrue((fresh/'assembled/awakening-35-effects-only.mp4').is_file())
            self.assertEqual(preserved,{p:(production.sha256(p),p.stat().st_mtime_ns) for p in preserved})
            source.write_bytes(b'changed source')
            with self.assertRaises(RuntimeError):assemble.validate_render_provenance(root,32,18,synthetic_fixture=True)
            report=json.loads((audio/'audio-report.json').read_text());report['effects_sha256']='stale'
            production.atomic_json(audio/'audio-report.json',report)
            with self.assertRaises(RuntimeError):assemble.validate_audio_provenance(audio)


if __name__=='__main__':unittest.main()
