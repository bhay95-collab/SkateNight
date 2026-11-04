const median = (values) => values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;

// Keep the media-clock estimator unchanged while independently checking it
// against the frame's expected presentation time and interpolated song clock.
export function songClockAlignment(result, manifest) {
  const { handoff, fps } = manifest;
  const locked = result.samples.filter((s) => s.playing && s.track === handoff.openerTrackId && s.song > 0.15);
  const mediaOffsetSec = median(locked.map((s) => s.film - s.song));
  const presentedOffsets = [];
  let i = 0;
  for (const [wall, media] of result.frames) {
    while (i + 1 < locked.length && locked[i + 1].wall < wall) i++;
    const a = locked[i], b = locked[i + 1];
    if (!a || !b || wall < a.wall || wall > b.wall || b.wall - a.wall > 100) continue;
    const song = a.song + (b.song - a.song) * (wall - a.wall) / (b.wall - a.wall);
    presentedOffsets.push(media - song);
  }
  const presentedOffsetSec = median(presentedOffsets);
  const sinkLatencyMs = fps === 30 ? (result.stats.outputLatencySec || 0) * 1000 : 0;
  const mediaStartErrorMs = mediaOffsetSec == null ? null : (mediaOffsetSec - handoff.songStartSec) * 1000;
  return {
    mediaSamples: locked.length, presentedSamples: presentedOffsets.length,
    mediaOffsetSec, presentedOffsetSec, mediaStartErrorMs, sinkLatencyMs,
    estimatedAudibleStartErrorMs: mediaStartErrorMs == null ? null : mediaStartErrorMs + sinkLatencyMs,
    presentedEstimatedAudibleStartErrorMs: presentedOffsetSec == null ? null
      : (presentedOffsetSec - handoff.songStartSec) * 1000 + sinkLatencyMs,
    presentationClockDifferenceMs: mediaOffsetSec == null || presentedOffsetSec == null ? null
      : (presentedOffsetSec - mediaOffsetSec) * 1000,
  };
}

// Presentation, clock and phase evidence for the critical registration window.
export function registrationContinuity(result, manifest) {
  const { fps, cues, handoff } = manifest;
  const start = cues.registrationStartFrame / fps;
  const end = cues.finalCinematicFrame / fps;
  const frames = result.frames || [];
  const intervals = frames.slice(1).flatMap(([wall, media], i) => {
    const [previousWall, previousMedia] = frames[i];
    return media >= start && previousMedia <= end ? [[wall - previousWall, media - previousMedia]] : [];
  });
  const tail = frames.at(-1);
  const sink = fps === 30 ? (result.stats.outputLatencySec || 0) : 0;
  const registering = result.samples.filter((s) => s.film >= start && s.film <= end + 1 / fps);
  const clockSamples = registering.filter((s) => s.playing && s.track === handoff.openerTrackId && s.song > 0);
  const drift = clockSamples.map((s) => Math.abs((s.film - handoff.songStartSec - s.song + sink) * 1000));
  const period = 60000 / handoff.record.rpm;
  const exposed = result.samples.filter((s) => s.live && s.wall >= result.stats.filmEndedMs
    && s.wall <= result.stats.filmEndedMs + 150 && s.filmOpacity < 0.999 && Number.isFinite(s.spinMs));
  const phaseErrors = exposed.map((s) => {
    const actual = s.spinMs / period * 360;
    const expected = handoff.record.cssAngleDeg + (s.wall - result.stats.filmEndedMs) / period * 360;
    return Math.abs(((actual - expected + 540) % 360) - 180);
  });
  return {
    startSec: start, endSec: end,
    presentedSamples: frames.filter(([, media]) => media >= start && media <= end + 0.001).length,
    maxGapMs: intervals.length ? Math.max(...intervals.map(([gap]) => gap), Math.max(0, result.stats.filmEndedMs - tail[0])) : null,
    maxMediaStepFrames: intervals.length ? Math.max(...intervals.map(([, advance]) => advance * fps)) : null,
    lastPresentedFrame: tail ? Math.round(tail[1] * fps) : null,
    finalFramePresented: Boolean(tail && Math.abs(tail[1] - end) < 0.5 / fps),
    clockSamples: clockSamples.length,
    maxEstimatedAudibleDriftMs: drift.length ? Math.max(...drift) : null,
    liveBackgroundReady: registering.length > 0 && registering.every((s) => s.live),
    exposedPhaseSamples: exposed.length,
    maxExposedPhaseErrorDeg: phaseErrors.length ? Math.max(...phaseErrors) : null,
  };
}
