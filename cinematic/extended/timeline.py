"""Selected 35-second native-30 contract; safe to import without Blender."""
import hashlib
import json
import math
from pathlib import Path

MANIFEST_PATH = Path(__file__).with_name("cues.json")


def load_manifest(path=MANIFEST_PATH):
    manifest = json.loads(Path(path).read_text())
    if (type(manifest['schema_version']) is not int or manifest['schema_version'] != 1
            or manifest['version'] != 'production-preview-35s-native30-v1'
            or manifest['film_kind'] != 'production-preview'
            or manifest["fps"] != 30 or manifest["frame_count"] != 1050
            or manifest["duration_seconds"] != 35 or manifest["experimental"] is not True):
        raise ValueError("Expected isolated experimental 35-second / 1050-frame native-30 contract")
    fps,count,duration=manifest['fps'],manifest['frame_count'],manifest['duration_seconds']
    cues=manifest['cues'];audio=manifest['audio'];c1=manifest['c1']
    major=('coinStart','coinGone','hallReveal','coinImpact','relay','attempt','almost',
           'failure','tick','catch','ignite','transmission','carousel','activeRecord',
           'grooveDescent','canyonFlight','grooveExit','stylusApproach','stylusContact',
           'registrationStart','final')
    def seconds(value,name):
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<duration:
            raise ValueError(f'{name} must be finite seconds inside the film')
        return value
    times=[seconds(cues[name],name) for name in major]
    if times[0]!=0 or any(a>=b for a,b in zip(times,times[1:])):
        raise ValueError('Major narrative cues must be strictly ordered from frame zero')
    beats=cues['heartbeats']
    if not isinstance(beats,list) or not beats:
        raise ValueError('heartbeats must be a nonempty ordered list')
    beats=[seconds(t,'heartbeat') for t in beats]
    if any(a>=b for a,b in zip([cues['catch'],*beats],[*beats,cues['ignite']])):
        raise ValueError('Heartbeats must progress between catch and ignition')
    frames={name:math.floor(cues[name]*fps+.5) for name in major}
    # These anchors are implemented by the cabinet boundary, physical scene
    # builders and approved C1 source sampler. Retiming them requires code work.
    locked={'coinGone':93,'transmission':405,'grooveDescent':606,'stylusApproach':915,
            'stylusContact':948,'registrationStart':1028,'final':1049}
    if any(frames[name]!=frame for name,frame in locked.items()):
        raise ValueError('The implemented native-30 scene/C1 anchors are locked')
    sample=1/48000
    for name in ('stylusApproach','stylusContact','registrationStart','final'):
        if abs(cues[name]-frames[name]/fps)>sample:
            raise ValueError(f'{name} must match its implemented visual sample')
    for name in ('songPlayback','firstHit','coinImpact'):seconds(audio[name],'audio.'+name)
    first_hit=seconds(manifest['opener']['first_hit_seconds'],'opener.first_hit_seconds')
    if (manifest['opener']['track_id']!='praise-lifted-on-high' or abs(first_hit-.207)>sample
        or abs(audio['songPlayback']+first_hit-cues['stylusContact'])>sample
        or abs(audio['firstHit']-cues['stylusContact'])>sample
        or abs(audio['coinImpact']-cues['coinImpact'])>sample
        or abs(cues['final']-(count-1)/fps)>sample):
        raise ValueError('Audio first hit, coin impact or final visual sample is inconsistent')
    expected_c1={'source_fps':60,'approach_source_start':175,'contact_source_frame':240,
                 'final_source_frame':443,'approach_frames':33,'landing_frames':102}
    if (any(type(c1[name]) is not int or c1[name]!=value for name,value in expected_c1.items())
        or c1['approach_frames']!=frames['stylusContact']-frames['stylusApproach']
        or c1['landing_frames']!=count-frames['stylusContact']):
        raise ValueError('C1 must retain the approved 175..443 source poses and native-30 counts')
    # The source C1 camera is fixed. Reject metadata that would describe a
    # different landing before rendering, rather than at the PWA import gate.
    expected_record={'cx':.603125,'cy':.39018517953378185,'r':.047135416666666666,
                     'cssAngleDeg':91.0557374652127,'rpm':45}
    record=c1.get('record')
    if not isinstance(record,dict):
        raise ValueError('C1 must describe the approved record registration')
    for name,value in expected_record.items():
        actual=record.get(name)
        if (isinstance(actual,bool) or not isinstance(actual,(int,float)) or not math.isfinite(actual)
                or abs(actual-value)>1e-9):
            raise ValueError(f'C1 record {name} differs from the approved camera/PWA contract')
    boundaries=[('cabinet',0,frames['coinGone']-1),('story',frames['coinGone'],frames['transmission']-1),
                ('changer',frames['transmission'],frames['grooveDescent']-1),('vinyl',frames['grooveDescent'],count-1)]
    actual=[(shot['id'],shot['start'],shot['end']) for shot in manifest['shots']]
    if actual!=boundaries:
        raise ValueError('Shot boundaries must match the implemented cue-derived scene ranges')
    expected = 0
    for shot in manifest["shots"]:
        if (type(shot['start']) is not int or type(shot['end']) is not int
                or shot["start"] != expected or shot["end"] < shot["start"]):
            raise ValueError("Shot ranges must cover each frame exactly once")
        expected = shot["end"] + 1
    if expected != manifest["frame_count"]:
        raise ValueError("Shot ranges do not cover the timeline")
    return manifest


MANIFEST = load_manifest()
FPS = MANIFEST["fps"]
FRAME_COUNT = MANIFEST["frame_count"]
DURATION = MANIFEST["duration_seconds"]
CUES = MANIFEST["cues"]
AUDIO = MANIFEST["audio"]


def visual_frame(seconds):
    return math.floor(float(seconds) * FPS + 0.5)


FRAMES = {name: ([visual_frame(t) for t in value] if isinstance(value, list)
                 else visual_frame(value)) for name, value in CUES.items()}


def shot_for_frame(frame):
    for shot in MANIFEST["shots"]:
        if shot["start"] <= frame <= shot["end"]:
            return shot["id"]
    raise ValueError(f"Frame outside 0..{FRAME_COUNT - 1}: {frame}")


def source_frame_for_c1(frame):
    if FRAMES["stylusApproach"] <= frame < FRAMES["stylusContact"]:
        return 175 + 2 * (frame - FRAMES["stylusApproach"])
    if FRAMES["stylusContact"] <= frame < FRAME_COUNT:
        return 443 if frame == FRAME_COUNT - 1 else 240 + 2 * (frame - FRAMES["stylusContact"])
    raise ValueError("C1 source sampling begins at stylusApproach")


def manifest_sha256():
    return hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest()
