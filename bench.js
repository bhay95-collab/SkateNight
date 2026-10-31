/* ============================================================
   BENCH - measures the Awakening on the machine it runs on (?bench).

   Headless software rendering can't say how the event laptop performs, so
   this runs in the real browser on the real hardware and reports:
     frames   every animation frame from the press to three seconds after
              the reveal: median and 95th/99th percentile intervals, how
              many frames missed (took longer than 1.5 refreshes), the
              longest gaps and when they happened
     stalls   main-thread long tasks (over 50 ms), with when they happened
     gpu      GPU time per 3D frame (the Plunge), where the browser exposes
              a timer (EXT_disjoint_timer_query_webgl2)
     sync     when the song really started against the machine's beat
              (it should land one beat after the cut), and when the light
              came against the song's own accent
     machine  the GPU's name, screen, pixel ratio, browser
   Shown at the end in a panel with a Copy button. Nothing here runs unless
   the address asks for it.
   ============================================================ */
export const BENCH = (() => { try { return new URLSearchParams(location.search).has('bench'); } catch { return false; } })();

const marks = {};
const frames = [];
const stalls = [];
let observing = false;

export function benchMark(name, at = performance.now()) {
  if (!BENCH) return;
  if (marks[name] == null) marks[name] = at;
  if (name === 'press' && !observing) start();
}

function start() {
  observing = true;
  const tick = (now) => { frames.push(now); if (!marks.done) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => stalls.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: false });
  } catch { /* not supported */ }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'no WebGL');
  } catch { return 'unknown'; }
}

export function benchReport({ beatMs, gridLeadMs, revealAtS, outputLatencyS }) {
  if (!BENCH) return null;
  const p = marks.press ?? 0;
  const rel = (t) => (t == null ? null : Math.round(t - p));
  const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const refresh = sorted.length ? pct(sorted, 0.5) : 16.7;
  const missed = gaps.filter((g) => g > refresh * 1.5).length;
  const worst = gaps.map((g, i) => [Math.round(frames[i] - p), Math.round(g)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const plunge = window.__plungeStats;
  const gpu = plunge?.gpu?.length ? [...plunge.gpu].sort((a, b) => a - b) : null;
  const songStart = marks.songZero != null ? marks.songZero : null;
  const report = {
    machine: { gpu: gpuName(), screen: `${screen.width}x${screen.height}`, window: `${innerWidth}x${innerHeight}`, pixelRatio: devicePixelRatio, browser: navigator.userAgent, address: location.search },
    frames: { count: gaps.length, refreshMs: +refresh.toFixed(2), medianMs: +refresh.toFixed(2), p95Ms: sorted.length ? +pct(sorted, 0.95).toFixed(2) : null, p99Ms: sorted.length ? +pct(sorted, 0.99).toFixed(2) : null, missed, missedPct: gaps.length ? +((100 * missed) / gaps.length).toFixed(1) : null, worstGaps: worst },
    stalls: stalls.filter(([s]) => s >= p - 50).map(([s, d]) => [Math.round(s - p), d]),
    gpu: gpu ? { frames: gpu.length, medianMs: +pct(gpu, 0.5).toFixed(2), p95Ms: +pct(gpu, 0.95).toFixed(2), maxMs: +gpu.at(-1).toFixed(2) } : 'no GPU timer (or no 3D in this cut)',
    sync: {
      cutMs: rel(marks.cut),
      songStartedMs: songStart == null ? null : rel(songStart),
      songFirstHitVsGridMs: songStart == null || marks.cut == null ? null : Math.round(songStart + gridLeadMs - (marks.cut + beatMs)),
      revealMs: rel(marks.reveal),
      revealVsAccentMs: songStart == null || marks.reveal == null ? null : Math.round(marks.reveal - (songStart + revealAtS * 1000 + outputLatencyS * 1000)),
      outputLatencyMs: Math.round(outputLatencyS * 1000),
    },
  };
  return report;
}

export function showReport(report) {
  if (!report) return;
  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Benchmark report');
  Object.assign(box.style, { position: 'fixed', inset: 'auto 16px 16px auto', maxWidth: 'min(560px, calc(100vw - 32px))', maxHeight: '70vh', overflow: 'auto', zIndex: 200,
    background: '#0b0a10', color: '#e9e4da', border: '1px solid #3fe3dc', borderRadius: '8px', padding: '14px', font: '12px/1.45 ui-monospace, Menlo, monospace' });
  const text = JSON.stringify(report, null, 1);
  const pre = document.createElement('pre');
  pre.textContent = text;
  pre.style.whiteSpace = 'pre-wrap';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy report';
  Object.assign(copy.style, { font: 'inherit', padding: '6px 10px', marginBottom: '8px', cursor: 'pointer' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; } catch {
      const range = document.createRange(); range.selectNodeContents(pre); getSelection().removeAllRanges(); getSelection().addRange(range); copy.textContent = 'Selected: press Ctrl+C';
    }
  });
  box.append(copy, pre);
  document.body.append(box);
}
