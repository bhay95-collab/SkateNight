"""Small invariant checks for cue arithmetic and editorial preservation."""
import json
from pathlib import Path
import unittest
from assemble_study import EDITS,quantize


class StudyTiming(unittest.TestCase):
    def test_visual_quantization(self):
        self.assertEqual(quantize(5.25),158)
        self.assertEqual(quantize(5.45),164)
        self.assertEqual(quantize(35.1),1053)

    def test_cuts_keep_opening_and_ending(self):
        for name,edit in EDITS.items():
            self.assertEqual(sum(x[2] for x in edit),round(float(name)*30))
            self.assertEqual(edit[0],("opening",0,164))
            self.assertEqual(edit[-1],("landing",0,102))
            self.assertIn(("stylus",0,33),edit)
            self.assertGreaterEqual((33+102)/30,(443-175+1)/60)
            contact=(sum(x[2] for x in edit)-102)/30
            self.assertAlmostEqual(float(name)-(contact-.207),3.607)

    def test_audio_precision_and_landing(self):
        cue=json.loads((Path(__file__).parent/"cues.json").read_text())
        self.assertAlmostEqual(cue["seconds"]["stylusContact"]-cue["song"]["startSec"],.207)
        self.assertEqual(quantize(cue["seconds"]["final"]),1154)
        self.assertLess(abs(cue["durationSec"]-cue["song"]["startSec"]-cue["song"]["revealAtSec"]),1/30)


if __name__=="__main__":unittest.main()
