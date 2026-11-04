"""Keep superseded exit timings out of the finishing render budget."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zlib

SOURCE=Path(__file__).resolve().parents[1]/'cinematic/extended/review.py'
spec=importlib.util.spec_from_file_location('extended_review_test',SOURCE)
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)


class ReviewCostTests(unittest.TestCase):
    def test_current_phase_samples_replace_old_exit_costs_and_peak_memory(self):
        def chunk(kind,payload):
            return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
        png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1920,1080,8,2,0,0,0))
             +chunk(b'IDAT',zlib.compress((b'\x00'+b'\x18\x30\x48'*1920)*1080))+chunk(b'IEND',b''))
        def report(root,shot,samples):
            directory=root/shot;directory.mkdir(parents=True)
            rows=[]
            for frame,seconds,memory in samples:
                (directory/f'frame_{frame:04}.png').write_bytes(png)
                rows.append(dict(frame=frame,wall_seconds=seconds,bytes=len(png),peak_rss_bytes=memory*1024**3))
            (directory/f'render-{shot}.json').write_text(json.dumps(dict(width=1920,height=1080,samples=128 if shot=='story' else 96,engine='cycles',frames=rows)))
        with tempfile.TemporaryDirectory() as temp:
            primary=Path(temp)/'current';old=Path(temp)/'old'
            report(old,'story',[(380,200,2)])
            report(old,'changer',[(480,70,2),(542,72,2)])
            report(old,'vinyl',[(680,999,14),(840,500,12),(867,700,12),(868,900,12),(948,80,2),(1049,10,2)])
            report(primary,'vinyl',[(680,120,3),(868,150,3),(907,180,3)])
            model=review.cost_model(primary,(old,));phases={p['phase']:p for p in model['phases']}
            self.assertEqual(model['blender_frames'],957)
            self.assertEqual(phases['groove exit']['frames'],92)
            self.assertEqual(phases['LOD surface blend']['frames'],10)
            self.assertEqual(phases['groove exit']['sample_frames'],[868])
            self.assertEqual(phases['groove exit']['mean_seconds_per_frame'],150)
            self.assertEqual(phases['LOD surface blend']['sample_frames'],[907])
            self.assertEqual(phases['vinyl descent']['sample_frames'],[680])
            self.assertTrue(phases['vinyl descent']['borrowed_nearest_phase_sample'])
            self.assertEqual(phases['C1 approach and contact']['sample_frames'],[948,1049])
            self.assertEqual(phases['story']['mean_seconds_per_frame'],200)
            self.assertEqual(model['peak_observed_process_rss_gib'],3)


if __name__=='__main__':unittest.main()
