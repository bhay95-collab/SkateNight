/* ============================================================
   STARTUP PLUNGE - Treatment A of the extended cut, in WebGL (in
   development, ?cut=plunge only; never with reduced motion).

   The machine's inside is its own record changer at an impossible scale:
   a turntable platter 100 m across with strobe dots on its rim, a record
   on it, a tonearm like a crane on a pillar, the magazine of records
   standing like a tower, the motor and idler wheel underneath, a
   contactor on the wall, the coin box on the floor - and, hanging high
   above the platter, the back of the picture tube. Everything is lit only
   by what is powered.

     the slit     the cabinet's camera pushes in on the coin slot along one
                  zoom curve (diveZoom); when the slit is big on screen this
                  picture takes over in the same place - the slot, the lit
                  top of the coin entry, the door - and carries on, through
                  the lips, into a small chamber
     the drop     out through the chamber's floor into the hall, falling
                  with the coin (g, scaled), past the platter's rim within
                  metres; the camera lands hard by the coin box
     A            the contactor slams; the motor arcs; the idler bites; the
                  whole platter strains a few degrees and is dragged back;
                  the tonearm lifts and falls again; the supply dies; the
                  valve's afterglow is the only light
     B            high above, the screen lights first - the robot - and its
                  light falls on the record. The motor catches: the platter
                  turns, pushed on every heartbeat, the strobe lamp firing on
                  each; the tonearm swings over and the needle drops on the
                  third beat, so the lock's thumps are the needle in the
                  lead-in groove. The camera rises past the rim, over the
                  turning record, up to the screen
     through      into the phosphor until the robot fills the frame; the
                  cabinet's camera starts from that framing on its own tube
                  and pulls back to the lock (startup.js)

   One canvas, one draw a frame, nothing on the main thread but a few
   hundred draw calls. Units are cabinet em (the coin is 8 em).
   ============================================================ */
import { BEATS, PULSE, supplyAt } from './startup-timing.js';

const { gone, credit, relay, attempt, almost, fail, tick, catch: caught, surface, through, ignite } = BEATS;
export const PLUNGE_T = {
  dive: gone + 250,        // the cabinet's camera starts pushing into the slit
  hand: gone + 750,        // this picture takes over, matched (a 130 ms dissolve while both show the same thing)
  domGone: gone + 880,     // the cabinet is no longer drawn
  hole: gone + 1150,       // through the chamber's floor: the fall begins
  land: credit,
  rise: caught + 250,
  surface,
  out: through,            // the robot fills the frame; the cabinet's camera takes it back
  done: through + 160,
};
export const ZOOM_END = 6;             // the cabinet camera's zoom on the slit when this picture has taken over
export const OUT_FILL = 0.8;           // how much of the frame's height the robot fills at the hand-back

/* The cabinet camera's zoom during the dive: exponential, accelerating. */
export function diveZoom(t, push) {
  const u = Math.min(1, Math.max(0, (t - PLUNGE_T.dive) / (PLUNGE_T.domGone - PLUNGE_T.dive)));
  return push * (ZOOM_END / push) ** (u * u);
}

/* ---------------- math ---------------- */
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const M = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  trans: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  scale: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  rotX: (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  rotY: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rotZ: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; },
  look(eye, at, up) {
    const z = V.norm(V.sub(eye, at)); const x = V.norm(V.cross(up, z)); const y = V.cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1];
  },
};
const chain = (...ms) => ms.reduce((a, b) => M.mul(a, b));
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;

/* ---------------- the space (em) ---------------- */
const HOLE = [0, -6, -8];                   // the chamber's floor opening, the top of the fall
const G = 3267;                             // em/s^2: g, at the coin's scale (a 24 mm coin is 8 em)
const BOX_Y = -9050;
const PLATTER = { c: [-5150, -6400, -900], r: 5000, h: 380 };   // top of the platter at c.y: low, so the struggle is right above the landing
const RECORD_R = 4800;
const PILLAR = [-600, 0, 5200];             // the tonearm's pivot (x, -, z)
const ARM = { y: -6040, len: 7600, rest: 2.05, play: 2.62 };    // heading angles about y (radians)
const CRT = { c: [-5150, -2600, -900], w: 4400, h: 3300 };      // the face, horizontal, looking down
const ROBOT_SIZE = 2200;                    // the robot on the face, em
const SURFACE_D = 1900;                     // how far below the face the rise arrives (clear of the spindle)
const MOTOR = [-1500, -7700, -900];
const IDLER = [-560, -6960, -900];
const STROBE = [420, -6580, -260];
const VALVE = [-1500, -6900, -120];
const CONTACTOR = [2600, -7900, -2600];
const IRON = [0.16, 0.15, 0.18], STEEL = [0.34, 0.33, 0.37], BRASS = [0.58, 0.42, 0.2], VINYL = [0.05, 0.05, 0.06];

/* ---------------- the camera ---------------- */
function coinAt(t) {
  if (t < PLUNGE_T.hole - 200) return [0, 0.2, -4 - Math.max(0, t - PLUNGE_T.hand) * 0.02];
  const s = Math.max(0, t - (PLUNGE_T.hole - 200)) / 1000;
  return [Math.sin(s * 3) * 30, Math.max(HOLE[1] - 0.5 * G * s * s, BOX_Y + 140), HOLE[2] - s * 40];
}
/* Keyframes through the hall: [ms, eye, at, up]. Between them the camera moves on a smooth curve. */
const UP = [0, 1, 0];
const REST = { eye: [1700, -8600, 2600], at: [-900, -6900, -900] };   // landed, low by the box, looking up at the platter's edge, the idler and the motor
function path(t, keys) {
  let i = 1; while (i < keys.length - 1 && t > keys[i][0]) i++;
  const [t0, e0, a0, u0 = UP] = keys[i - 1]; const [t1, e1, a1, u1 = UP] = keys[i];
  const k = smooth((t - t0) / (t1 - t0));
  return { eye: V.lerp(e0, e1, k), at: V.lerp(a0, a1, k), up: V.norm(V.lerp(u0, u1, k)) };
}
const RISE = [
  [PLUNGE_T.rise, REST.eye, REST.at],
  [PLUNGE_T.rise + 1300, [1000, -7900, 1500], [-3000, -6500, -900]],               // up past the turning rim
  [PLUNGE_T.rise + 1900, [150, -6120, 700], [-3600, -6360, -800]],                  // skimming the record's edge, the arm swinging in
  [PLUNGE_T.rise + 2300, [-3300, -4900, -300], CRT.c, [0, 0, -1]],                  // turning up to the screen
  [PLUNGE_T.surface, [CRT.c[0], CRT.c[1] - SURFACE_D, CRT.c[2]], CRT.c, [0, 0, -1]],
];
export function camera3d(t, vh, em, push) {
  const fovDeg = 60;
  const F = vh / 2 / Math.tan((fovDeg * Math.PI) / 360);    // px per unit at distance 1
  if (t < PLUNGE_T.domGone) {                                 // matched to the cabinet's own zoom on the slit
    const d = F / (diveZoom(t, push) * em);
    return { eye: [0, 0, d], at: [0, 0, 0], up: UP, near: d * 0.2, fov: fovDeg };
  }
  if (t < PLUNGE_T.hole) {                                    // on through the lips, into the chamber, and down
    const k = (t - PLUNGE_T.domGone) / (PLUNGE_T.hole - PLUNGE_T.domGone);
    const d0 = F / (ZOOM_END * em);
    const z = d0 - (d0 + 9) * easeOut(k * 1.4);
    const pitch = smooth((k - 0.45) / 0.55);
    return { eye: [0, -2 * pitch, z], at: [0, -2 * pitch - 6 * pitch, z - 6 * (1 - pitch)], up: V.norm([0, 1 - pitch, -pitch]), near: 0.05, fov: fovDeg };
  }
  if (t < PLUNGE_T.land) {                                    // falling with the coin
    const c = coinAt(t);
    const k = (t - PLUNGE_T.hole) / (PLUNGE_T.land - PLUNGE_T.hole);
    const trail = 40 + 520 * Math.sin(k * Math.PI);
    let eye = [c[0] + 260 * Math.sin(k * Math.PI), c[1] + trail, c[2] + (90 + 900 * k) * smooth(k / 0.15)];
    let at = [c[0], c[1] - 400, c[2] - 120];
    const fromHole = smooth(k / 0.08);                         // out of the chamber's floor without a jump
    eye = V.lerp([0, -2 - (t - PLUNGE_T.hole) * 0.05, HOLE[2]], eye, fromHole);
    const toRest = smooth((k - 0.62) / 0.38);                  // braking: it turns to the machine and comes to rest by the box
    eye = V.lerp(eye, REST.eye, toRest); at = V.lerp(at, REST.at, toRest);
    return { eye, at, up: V.norm([0, 0.2 + toRest, -1 + toRest]), near: 2, fov: fovDeg };
  }
  if (t < PLUNGE_T.rise) {                                    // landed: hard, then still
    const k = t - PLUNGE_T.land;
    const settle = k < 520 ? Math.sin((k / 520) * Math.PI * 2) * Math.exp(-k / 170) * 120 : 0;
    return { eye: V.add(REST.eye, [0, -settle, 0]), at: REST.at, up: UP, near: 4, fov: fovDeg };
  }
  if (t < PLUNGE_T.surface) return { ...path(t, RISE), near: 4, fov: fovDeg };
  // into the phosphor until the robot fills OUT_FILL of the frame's height
  const dEnd = ROBOT_SIZE / (2 * OUT_FILL * Math.tan((fovDeg * Math.PI) / 360));
  const k = easeOut((t - PLUNGE_T.surface) / (PLUNGE_T.out - PLUNGE_T.surface));
  const y = CRT.c[1] - (SURFACE_D - (SURFACE_D - dEnd) * k);
  return { eye: [CRT.c[0], y, CRT.c[2]], at: CRT.c, up: [0, 0, -1], near: 4, fov: fovDeg };
}

/* ---------------- the machine's motion ---------------- */
const BEATS_ALL = [...PULSE.heartbeat, ...PULSE.lock];
const DOT = (Math.PI * 2) / 200;            // the strobe dots' spacing on the rim
function platterAngle(t) {
  if (t < attempt) return 0;
  if (t < caught) {                         // A: it strains a few degrees against its own mass, and is dragged back
    if (t < fail) return -0.05 * smooth((t - attempt) / (almost - attempt)) ** 1.4 + (t > almost ? 0.006 * Math.sin((t - almost) / 55) : 0);
    const k = (t - fail) / 900;
    return -0.05 * Math.exp(-k * 2.2) * Math.cos(k * 7);
  }
  // B: pushed on every beat - more each beat - until it moves a whole number of dots a beat (the strobe freezes them)
  let a = 0;
  BEATS_ALL.forEach((b, n) => {
    if (t <= b) return;
    const step = DOT * Math.min(6, n + 1);
    a -= step * easeOut((t - b) / 380);
  });
  return a;
}
function armPose(t) {                       // [heading, lift (em)]
  if (t < attempt) return [ARM.rest, 0];
  if (t < caught) {                         // A: the cueing tries to lift it, and lets it fall
    const up = t < almost ? smooth((t - attempt - 300) / 700) * 160 : t < fail ? 160 - 40 * smooth((t - almost) / 300) : 120 * (1 - smooth((t - fail) / 180));
    return [ARM.rest, up];
  }
  const [h1, h2, h3] = PULSE.heartbeat;
  const swing = smooth((t - h1) / (h3 - h1 - 120));
  const lift = t < h3 ? 160 * smooth((t - caught) / 400) : 160 * (1 - smooth((t - h3) / 110));   // the needle drops on the third beat
  return [ARM.rest + (ARM.play - ARM.rest) * swing, Math.max(0, lift)];
}

/* ---------------- WebGL ---------------- */
const VS = `#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n;
uniform mat4 uM, uVP; out vec3 vW; out vec3 vN;
void main(){ vec4 w = uM * vec4(p,1.); vW = w.xyz; vN = mat3(uM) * n; gl_Position = uVP * w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; out vec4 o;
uniform vec3 uCol, uEmit, uEye, uFog; uniform float uFogD, uRough;
uniform vec3 uLP[8]; uniform vec3 uLC[8]; uniform float uLR[8];
void main(){
  vec3 N = normalize(vN); vec3 Vd = normalize(uEye - vW);
  if (dot(N, Vd) < 0.) N = -N;
  vec3 c = uCol * 0.05;
  for (int i = 0; i < 8; i++) {
    vec3 L = uLP[i] - vW; float d = length(L); L /= d;
    float att = clamp(1. - d / uLR[i], 0., 1.); att *= att;
    vec3 H = normalize(L + Vd);
    c += uLC[i] * att * (uCol * max(dot(N, L), 0.) + pow(max(dot(N, H), 0.), mix(90., 8., uRough)) * (1. - uRough) * 0.7);
  }
  c += uFog * pow(1. - max(dot(N, Vd), 0.), 3.) * 0.8;   // edges catch the haze: shapes read against it
  c = c * 1.8 + uEmit;                                      // exposed for a projector, not a monitor
  o = vec4(mix(c, uFog, 1. - exp(-uFogD * length(uEye - vW))), 1.);
}`;
/* flat colour, unlit, per-vertex (the coin entry, matched to the cabinet's own painting) */
const PVS = `#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 c; uniform mat4 uVP; uniform float uK; out vec3 vC;
void main(){ vC = c * uK; gl_Position = uVP * vec4(p,1.); }`;
const PFS = `#version 300 es
precision highp float; in vec3 vC; out vec4 o; void main(){ o = vec4(vC, 1.); }`;
/* the robot on the face of the tube */
const TVS = `#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; uniform mat4 uM, uVP; out vec2 vT;
void main(){ vT = p.xy + .5; gl_Position = uVP * uM * vec4(p,1.); }`;
const TFS = `#version 300 es
precision highp float; in vec2 vT; uniform sampler2D uTex; uniform vec3 uBack; uniform float uK; out vec4 o;
// mirrored as the cabinet shows it, so the hand-back matches
void main(){ vec4 r = texture(uTex, vec2(1. - vT.x, vT.y)); float edge = smoothstep(.0, .06, min(min(vT.x, 1.-vT.x), min(vT.y, 1.-vT.y)));
  o = vec4((uBack * (.55 + .45 * (1. - length(vT - .5) * 1.2)) + r.rgb * r.a * 1.05) * uK * edge, 1.); }`;
const AVS = `#version 300 es
layout(location=0) in vec3 p; uniform mat4 uVP; uniform vec3 uEye; uniform float uT, uPx; out float vB;
void main(){ vec3 q = p + vec3(sin(uT*.0004 + p.y*.01)*40., -mod(uT*.05 + p.x*3., 600.), cos(uT*.0003 + p.z*.01)*40.);
  vec4 c = uVP * vec4(q,1.); gl_Position = c; float d = length(uEye - q); gl_PointSize = clamp(uPx * 60. / d, 1., 5.); vB = clamp(1. - d/5000., 0., 1.); }`;
const AFS = `#version 300 es
precision highp float; in float vB; uniform vec3 uCol; out vec4 o; void main(){ float a = smoothstep(.5, .1, length(gl_PointCoord - .5)); o = vec4(uCol * vB * a, 1.); }`;

function makeGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return null;
  const program = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const cache = {};
    return { p, u: (k) => (k in cache ? cache[k] : (cache[k] = gl.getUniformLocation(p, k))) };
  };
  const mesh = (pos, nor, idx) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    [pos, nor].forEach((data, loc) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  };
  return { gl, program, mesh };
}

function boxData() {
  const P = [], N = [], I = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  for (const [n, u, v] of faces) {
    const b = P.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { for (let k = 0; k < 3; k++) P.push(0.5 * (n[k] + su * u[k] + sv * v[k])); N.push(...n); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return [P, N, I];
}
/* An annulus extruded along y (a disc, a ring, a cylinder when r0 = 0), centred. */
function ringData(r0, r1, h, seg) {
  const P = [], N = [], I = [];
  const quad = (a, b, c, d, n0, n1, n2, n3) => { const k = P.length / 3; P.push(...a, ...b, ...c, ...d); N.push(...n0, ...n1, ...n2, ...n3); I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), y = h / 2;
    quad([r1 * c0, -y, r1 * s0], [r1 * c1, -y, r1 * s1], [r1 * c1, y, r1 * s1], [r1 * c0, y, r1 * s0], [c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0]);
    if (r0 > 0) quad([r0 * c0, y, r0 * s0], [r0 * c1, y, r0 * s1], [r0 * c1, -y, r0 * s1], [r0 * c0, -y, r0 * s0], [-c0, 0, -s0], [-c1, 0, -s1], [-c1, 0, -s1], [-c0, 0, -s0]);
    quad([r0 * c0, y, r0 * s0], [r1 * c0, y, r1 * s0], [r1 * c1, y, r1 * s1], [r0 * c1, y, r0 * s1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
    quad([r0 * c1, -y, r0 * s1], [r1 * c1, -y, r1 * s1], [r1 * c0, -y, r1 * s0], [r0 * c0, -y, r0 * s0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]);
  }
  return [P, N, I];
}
/* The coin entry as the cabinet paints it, in em around the slit's centre (styles.css .mech-top/.mech-slit/.mech-face). */
function entryData() {
  const P = [], C = [], I = [];
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  // a vertical gradient band: [[y, colour], ...] from top to bottom, x from x0 to x1, at depth z
  const band = (x0, x1, stops, z = 0) => {
    for (let i = 0; i < stops.length - 1; i++) {
      const [ya, ca] = stops[i], [yb, cb] = stops[i + 1]; const k = P.length / 3;
      P.push(x0, ya, z, x1, ya, z, x1, yb, z, x0, yb, z); C.push(...ca, ...ca, ...cb, ...cb); I.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
  };
  const door = hex('#16111d');
  band(-60, 60, [[40, door], [1.12, door]], -0.05);                       // the door above and around
  band(-60, -6.5, [[1.12, door], [-40, door]], -0.05);
  band(6.5, 60, [[1.12, door], [-40, door]], -0.05);
  band(-6.3, 6.3, [[1.12, hex('#2c2536')], [0.16, hex('#6f6680')], [-1.09, hex('#c9c0d6')], [-1.28, hex('#e4dcef')]]);   // the top, catching the light
  band(-6.5, 6.5, [[-1.03, hex('#a59cb4')], [-2.5, hex('#5a5068')], [-7.7, hex('#3a3247')], [-15.9, hex('#241d2e')]], -0.02);   // the face
  band(-4.6, 4.6, [[0.26, [0, 0, 0]], [-0.03, hex('#0a0510')], [-0.26, hex('#ffb43a')]], 0.01);   // the slit, the lamp glowing up through it
  return [P, C, I];
}

/* ---------------- build and run ---------------- */
/* The canvas and its timing go in at the press, with everything else; the
   WebGL work (context, shaders, meshes) is done a moment later (buildPlunge). */
export function placePlunge(attract) {
  const canvas = document.createElement('canvas');
  canvas.className = 'plunge';
  canvas.setAttribute('aria-hidden', 'true');
  attract.querySelector('.attract-world')?.append(canvas);
  // shown over the cabinet only where the two match; the cabinet stops being drawn once this has taken over
  canvas.animate([{ opacity: 0 }, { opacity: 0, offset: PLUNGE_T.hand / PLUNGE_T.done }, { opacity: 1, offset: PLUNGE_T.domGone / PLUNGE_T.done },
    { opacity: 1, offset: PLUNGE_T.out / PLUNGE_T.done }, { opacity: 0 }], { duration: PLUNGE_T.done, fill: 'forwards' });
  return canvas;
}

export function buildPlunge(canvas, robotCanvas) {
  try {
    return buildScene(canvas, robotCanvas);
  } catch (err) {                            // any failure: no 3D, and nothing left over the cabinet
    console.warn('[plunge]', err);
    canvas.remove();
    return null;
  }
}

function buildScene(canvas, robotCanvas) {
  const made = makeGL(canvas);
  if (!made) throw new Error('no WebGL2');
  const { gl, program, mesh } = made;
  const SOLID = program(VS, FS), PAINT = program(PVS, PFS), TEX = program(TVS, TFS), DUST = program(AVS, AFS);
  const BOX = mesh(...boxData());
  const rings = new Map();
  const ring = (r0, r1, h, seg = 64) => { const k = [r0, r1, h, seg].join(); if (!rings.has(k)) rings.set(k, mesh(...ringData(r0, r1, h, seg))); return rings.get(k); };
  const ENTRY = mesh(...entryData());
  const QUAD = mesh([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 2, 0, 2, 3]);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  try { if (robotCanvas) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, robotCanvas); else throw new Error('no robot'); }
  catch { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); }

  // the still parts: [mesh, model, colour, roughness]
  const parts = [];
  const add = (m, model, col, rough = 0.7, emit = [0, 0, 0]) => parts.push({ m, model, col, rough, emit });
  const box = (x, y, z, w, h, d, col = IRON, rough = 0.75, rot = null) => add(BOX, rot ? chain(M.trans(x, y, z), rot, M.scale(w, h, d)) : chain(M.trans(x, y, z), M.scale(w, h, d)), col, rough);
  // the slit's lips and the little chamber behind it, with a hole in its floor
  for (const s of [-1, 1]) box(0, s * 0.42, -1, 10, 0.32, 2, BRASS, 0.3);
  box(0, 4.5, -8, 14, 0.6, 14, IRON); box(-7, -1, -8, 0.6, 12, 14, IRON); box(7, -1, -8, 0.6, 12, 14, IRON); box(0, -1, -15, 14, 12, 0.6, IRON);
  box(-4.75, -6, -8, 4.5, 0.6, 14, IRON); box(4.75, -6, -8, 4.5, 0.6, 14, IRON); box(0, -6, -12.5, 5, 0.6, 5, IRON); box(0, -6, -3.5, 5, 0.6, 5, IRON);
  // the hall's ceiling and its far walls of girders
  box(-4000, 120, -4000, 40000, 200, 40000, IRON, 0.9);
  for (let x = -14000; x <= 9000; x += 2600) box(x, -4600, -12000, 260, 9800, 260);
  for (let y = -9200; y <= 0; y += 2300) box(-2500, y, -12000, 23500, 160, 160);
  for (let y = -9200; y < 0; y += 2300) for (let x = -14000; x < 9000; x += 2600) box(x + 1300, y + 1150, -12000, 110, 3000, 110, IRON, 0.8, M.rotZ(((x + y) / 2600) % 2 ? 0.75 : -0.75));
  for (let z = -11000; z <= 3000; z += 2800) box(6200, -4600, z, 260, 9800, 260);
  box(-4000, BOX_Y - 400, -4000, 40000, 300, 40000, IRON, 0.95);                       // the floor
  // the platter's spindle bearing and column, the motor, the coin box, the contactor's frame, the tonearm's pillar
  add(ring(0, 700, PLATTER.c[1] - PLATTER.h - BOX_Y + 300, 40), M.trans(PLATTER.c[0], (PLATTER.c[1] - PLATTER.h + BOX_Y - 300) / 2, PLATTER.c[2]), IRON, 0.6);
  add(ring(0, 520, 900, 40), M.trans(...MOTOR), IRON, 0.6);
  box(MOTOR[0], MOTOR[1] - 2000, MOTOR[2], 400, 3400, 400);
  box(0, BOX_Y - 150, -8, 520, 300, 520, IRON, 0.8);
  box(0, BOX_Y + 6, -8, 140, 10, 40, [0.02, 0.02, 0.02], 0.9);
  box(CONTACTOR[0], CONTACTOR[1], CONTACTOR[2], 1300, 2000, 400);
  add(ring(0, 380, ARM.y - BOX_Y + 300, 32), M.trans(PILLAR[0], (ARM.y + BOX_Y - 300) / 2, PILLAR[2]), STEEL, 0.4);
  add(ring(0, 700, 300, 32), M.trans(PILLAR[0], ARM.y - 200, PILLAR[2]), IRON, 0.5);
  // the magazine: the records waiting, stacked like a tower
  for (let y = BOX_Y; y < -800; y += 170) add(ring(220, 2600, 34, 64), M.trans(-12300, y, -3600), y % 340 ? VINYL : [0.07, 0.06, 0.08], 0.3);
  add(ring(0, 220, -800 - BOX_Y, 24), M.trans(-12300, (BOX_Y - 800) / 2, -3600), STEEL, 0.4);
  // the valve on the motor's cabinet, the strobe lamp's housing
  box(VALVE[0], VALVE[1] - 300, VALVE[2], 260, 300, 260);
  box(STROBE[0], STROBE[1], STROBE[2] + 160, 200, 120, 160, IRON);

  const dust = (() => {
    const pts = []; let s = 11;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 1400; i++) pts.push((r() - 0.6) * 3000, -r() * 9000, -8 + (r() - 0.5) * 3000);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    return { vao, n: pts.length / 3 };
  })();

  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  return { canvas, gl, SOLID, PAINT, TEX, DUST, BOX, ring, ENTRY, QUAD, tex, parts, dust, timer };
}

/* Light from the supply, the beats and the story, at film time t. */
function lightsAt(t, coin) {
  const v = supplyAt(t);
  const lamp = t < relay ? 1 : t < relay + 90 ? 0.3 : 0;                      // the slot lamp, pouring through the slit until the relay cuts it
  const arc = t > attempt + 300 && t < fail + 60 ? (Math.sin(t * 0.13) * Math.sin(t * 0.071) > 0.35 ? 1 : 0.15) * v : 0;
  const slam = t > relay && t < relay + 140 ? 1 - (t - relay) / 140 : 0;
  const valve = t < fail + 380 ? v : 0.6 * Math.exp(-(t - fail - 380) / 900);
  const screen = t < caught + 60 ? 0 : smooth((t - caught - 60) / 260) * 1.2;  // the robot lights first
  const beat = BEATS_ALL.reduce((m, b) => (t >= b ? Math.max(m, Math.exp(-(t - b) / 70)) : m), 0);   // the strobe lamp, fired on each beat
  const tickLight = t > tick && t < tick + 70 ? 1 : 0;
  return [
    [V.add(HOLE, [0, -20, 0]), [6.5 * lamp, 4.6 * lamp, 2.6 * lamp], 11000],
    [V.add(coin, [20, 30, 40]), t < credit ? [0.9, 0.75, 0.45] : [0, 0, 0], 260],
    [V.add(IDLER, [300, -160, 500]), [3.3 * arc, 4.3 * arc, 6 * arc], 6500],
    [V.add(CONTACTOR, [0, 0, 600]), [4 * slam + 0.6 * tickLight, 4.6 * slam + 0.8 * tickLight, 5 * slam + tickLight], 5200],
    [V.add(VALVE, [0, 150, 0]), [4.5 * valve, 2.4 * valve, 0.7 * valve], 6500],
    [V.add(CRT.c, [0, -400, 0]), [1.1 * screen, 3.2 * screen, 3.4 * screen], 13000],
    [STROBE, [1.4 * beat, 1.7 * beat, 2 * beat], 2600],
    [[300, BOX_Y + 900, 300], [0.9, 0.6, 0.35], 4200],   // the coin box's pilot lamp
  ];
}

export function drawPlunge(scene, t, { vh, em, push, entryK = 1 }) {
  const { canvas, gl, SOLID, PAINT, TEX, DUST, BOX, ring, ENTRY, QUAD, tex, parts, dust } = scene;
  const w = canvas.width, h = canvas.height;
  gl.viewport(0, 0, w, h);
  const cam = camera3d(t, vh, em, push);
  const VP = M.mul(M.persp((cam.fov * Math.PI) / 180, w / h, cam.near, 40000), M.look(cam.eye, cam.at, cam.up));
  const fog = [0.075, 0.062, 0.095];
  gl.clearColor(...fog, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  const coin = coinAt(t);

  // the coin entry as the cabinet paints it, while we are in front of it
  if (t < PLUNGE_T.hole) {
    gl.useProgram(PAINT.p); gl.uniformMatrix4fv(PAINT.u('uVP'), false, VP); gl.uniform1f(PAINT.u('uK'), entryK);
    gl.bindVertexArray(ENTRY.vao); gl.drawElements(gl.TRIANGLES, ENTRY.count, gl.UNSIGNED_INT, 0);
  }
  const lights = lightsAt(t, coin);
  gl.useProgram(SOLID.p);
  gl.uniformMatrix4fv(SOLID.u('uVP'), false, VP);
  gl.uniform3fv(SOLID.u('uEye'), cam.eye); gl.uniform3fv(SOLID.u('uFog'), fog); gl.uniform1f(SOLID.u('uFogD'), 0.00011);
  gl.uniform3fv(SOLID.u('uLP[0]'), lights.flatMap((l) => l[0])); gl.uniform3fv(SOLID.u('uLC[0]'), lights.flatMap((l) => l[1])); gl.uniform1fv(SOLID.u('uLR[0]'), lights.map((l) => l[2]));
  const put = (m, model, col, rough, emit = [0, 0, 0]) => {
    gl.uniformMatrix4fv(SOLID.u('uM'), false, model); gl.uniform3fv(SOLID.u('uCol'), col); gl.uniform1f(SOLID.u('uRough'), rough); gl.uniform3fv(SOLID.u('uEmit'), emit);
    gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  };
  for (const p of parts) put(p.m, p.model, p.col, p.rough, p.emit);

  // the platter, its strobe dots, the record on it, the label, the spindle - all turning together
  const a = platterAngle(t);
  const P = chain(M.trans(PLATTER.c[0], PLATTER.c[1] - PLATTER.h / 2, PLATTER.c[2]), M.rotY(a));
  put(ring(PLATTER.r - 900, PLATTER.r, PLATTER.h, 160), P, IRON, 0.5);
  put(ring(0, PLATTER.r - 900, PLATTER.h * 0.6, 96), P, IRON, 0.7);
  for (let i = 0; i < 200; i++) put(BOX, chain(P, M.rotY(i * DOT), M.trans(PLATTER.r + 6, i % 2 ? 60 : -60, 0), M.scale(14, 70, 60)), i % 2 ? STEEL : [0.25, 0.24, 0.27], 0.3);
  const R = chain(M.trans(PLATTER.c[0], PLATTER.c[1] + 16, PLATTER.c[2]), M.rotY(a));
  put(ring(0, RECORD_R, 30, 160), R, VINYL, 0.12);
  for (let r = 1900; r < RECORD_R - 80; r += 260) put(ring(r, r + 26, 32, 160), R, [0.09, 0.09, 0.1], 0.05);   // the bands of the grooves catching light
  put(ring(0, 1650, 36, 96), R, [0.55, 0.12, 0.12], 0.6);                                                     // the label
  put(ring(0, 90, 700, 24), chain(R, M.trans(0, 350, 0)), STEEL, 0.25);                                      // the spindle
  // the motor's idler wheel, turning when the platter does (it drives it)
  put(ring(60, 300, 220, 32), chain(M.trans(...IDLER), M.rotY(-a * (PLATTER.r / 300))), STEEL, 0.3);
  // the tonearm: a crane over the record
  const [heading, lift] = armPose(t);
  const A = chain(M.trans(PILLAR[0], ARM.y + lift * 0.4, PILLAR[2]), M.rotY(heading), M.rotZ(-Math.atan2(lift, ARM.len)));
  put(BOX, chain(A, M.trans(ARM.len / 2, 0, 0), M.scale(ARM.len, 120, 120)), STEEL, 0.3);
  put(BOX, chain(A, M.trans(-700, 0, 0), M.scale(1100, 360, 360)), IRON, 0.5);                             // the counterweight
  put(BOX, chain(A, M.trans(ARM.len + 200, -120, 0), M.scale(600, 140, 300)), STEEL, 0.3);                  // the headshell
  put(BOX, chain(A, M.trans(ARM.len + 300, -260, 0), M.scale(30, 160, 30)), [0.9, 0.8, 0.5], 0.2, [0.1, 0.08, 0.03]);   // the stylus
  // the contactor's armature (it slams in at the relay), the coin, the valve's glass, the strobe lamp's lens
  const arm = t < relay ? 0 : Math.min(1, (t - relay) / 60);
  put(BOX, chain(M.trans(CONTACTOR[0], CONTACTOR[1] + 700 - arm * 520, CONTACTOR[2] + 300), M.scale(1100, 300, 300)), BRASS, 0.3);
  if (t > PLUNGE_T.hand && t < credit + 40) put(ring(0, 4, 0.6, 24), chain(M.trans(...coin), M.rotX(t * 0.011), M.rotZ(t * 0.007)), [0.9, 0.7, 0.3], 0.2, [0.7, 0.5, 0.18]);
  const L = lights;
  put(ring(0, 90, 260, 20), M.trans(VALVE[0], VALVE[1], VALVE[2]), [0.2, 0.15, 0.1], 0.2, L[4][1].map((c) => c * 0.45));
  put(ring(0, 60, 40, 20), chain(M.trans(STROBE[0], STROBE[1], STROBE[2] + 80), M.rotX(Math.PI / 2)), [0.3, 0.3, 0.32], 0.2, L[6][1].map((c) => c * 0.6));
  if (L[2][1][2] > 2) for (let i = 0; i < 14; i++) { const k = (t * 0.001 + i * 0.37) % 1; put(BOX, chain(M.trans(IDLER[0] + Math.sin(i * 7.1) * k * 500, IDLER[1] + k * 300 - k * k * 700, IDLER[2] + 300 + Math.cos(i * 3.3) * k * 300), M.scale(14, 14, 14)), [1, 1, 1], 1, [3, 3.4, 4]); }

  // the picture tube, hanging high above: its funnel, and its face with the robot on it
  const scr = smooth((t - caught - 60) / 260);
  put(BOX, chain(M.trans(CRT.c[0], CRT.c[1] + 1600, CRT.c[2]), M.scale(CRT.w + 400, 3000, CRT.h + 400)), [0.06, 0.06, 0.07], 0.6);
  gl.useProgram(TEX.p); gl.uniformMatrix4fv(TEX.u('uVP'), false, VP);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(TEX.u('uTex'), 0);
  gl.uniform3fv(TEX.u('uBack'), [0.18, 0.08, 0.28]); gl.uniform1f(TEX.u('uK'), 0.04 + scr);
  gl.uniformMatrix4fv(TEX.u('uM'), false, chain(M.trans(CRT.c[0], CRT.c[1] - 2, CRT.c[2]), M.rotX(Math.PI / 2), M.scale(CRT.w, CRT.h, 1)));
  gl.bindVertexArray(QUAD.vao); gl.drawElements(gl.TRIANGLES, QUAD.count, gl.UNSIGNED_INT, 0);
  gl.uniform3fv(TEX.u('uBack'), [0, 0, 0]);
  gl.uniformMatrix4fv(TEX.u('uM'), false, chain(M.trans(CRT.c[0], CRT.c[1] - 4, CRT.c[2]), M.rotX(Math.PI / 2), M.scale(ROBOT_SIZE, ROBOT_SIZE, 1)));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.drawElements(gl.TRIANGLES, QUAD.count, gl.UNSIGNED_INT, 0);
  // dust hanging in the lamp's light, while there is any
  gl.depthMask(false);
  gl.useProgram(DUST.p); gl.uniformMatrix4fv(DUST.u('uVP'), false, VP); gl.uniform3fv(DUST.u('uEye'), cam.eye); gl.uniform1f(DUST.u('uT'), t); gl.uniform1f(DUST.u('uPx'), h * 0.01);
  const glow = L[0][1][0] / 4.2 + L[5][1][1] / 1.6 * 0.5;
  gl.uniform3fv(DUST.u('uCol'), [0.5 * glow, 0.42 * glow, 0.3 * glow]);
  gl.bindVertexArray(dust.vao); gl.drawArrays(gl.POINTS, 0, dust.n);
  gl.depthMask(true); gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

/* Run it on the film's clock, from the dive to the hand-back. stats (for ?bench) collects frame and GPU times. */
export function stagePlunge(scene, el, film, { push, em }) {
  if (!scene) {                              // no WebGL: the cabinet is never hidden, so the standard picture plays on
    el.attract.querySelector('canvas.plunge')?.remove();
    return;
  }
  const { canvas, gl, timer } = scene;
  const size = () => { const r = devicePixelRatio || 1; canvas.width = Math.round(innerWidth * r); canvas.height = Math.round(innerHeight * r); };
  size();
  const stats = (window.__plungeStats = { frames: [], gpu: [], pending: [] });
  let raf = 0;
  let last = 0;
  // Tearing a WebGL canvas down can block on the GPU: never at the hand-back. It stops drawing there
  // (it is already invisible) and is let go when nothing is moving, a while after the song has come in.
  const release = () => {
    cancelAnimationFrame(raf);
    const drop = () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove(); };
    setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(drop, { timeout: 4000 }) : drop()), 12000);
  };
  const frame = (now) => {
    const t = film.now();
    if (t >= PLUNGE_T.done) { release(); return; }
    if (last) stats.frames.push(now - last);
    last = now;
    let q = null;
    if (timer && stats.pending.length < 4) { q = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, q); }
    drawPlunge(scene, t, { vh: innerHeight, em, push });
    if (q) { gl.endQuery(timer.TIME_ELAPSED_EXT); stats.pending.push(q); }
    stats.pending = stats.pending.filter((p) => {
      if (!gl.getQueryParameter(p, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) stats.gpu.push(gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(p);
      return false;
    });
    raf = requestAnimationFrame(frame);
  };
  film.at(PLUNGE_T.hand - 300, () => { size(); raf = requestAnimationFrame(frame); });
  window.__plungeDraw = (t) => drawPlunge(scene, t, { vh: innerHeight, em, push });   // for frame-by-frame capture of the film
  film.at(PLUNGE_T.done + 50, release);
}
