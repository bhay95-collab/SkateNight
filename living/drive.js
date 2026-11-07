// Platter drive: spindle motor -> 26T -> 32T -> 28T -> 40T. The approved pose solver already turns these
// gears with the record (apply_pose: spin * 26/T * (-1)**(3-j)); this keeps that relationship live.
// No clock of its own: the drive angle follows the record's CSS spin while playing and the authored
// spin curve (tracking spinDeg) during a change, so pause, skip, speed and film handoff can never drift.
export const DRIVE_TEETH = Object.freeze([26, 32, 28, 40]);
export const gearSign = (teeth) => (DRIVE_TEETH.indexOf(teeth) % 2 ? -1 : 1);
/** Clockwise screen degrees of a gear for drive angle D (the 26T pinion turns 1:1 with the platter). */
export const gearAngle = (drive, teeth) => drive * 26 / teeth * gearSign(teeth);

/** Nearest rendered frame (360/frames apart) and the small rotation left over for the browser. */
export function spriteFrame(angle, frames) {
  const step = 360 / frames, a = ((angle % 360) + 360) % 360, k = Math.round(a / step) % frames;
  let residual = a - k * step;
  if (residual > 180) residual -= 360;
  return { k, residual };
}

/* The drive's phase: engaged, it is the record angle plus a fixed offset; during a change it is the
   angle at the start of the move plus the authored spin; then it holds. It never jumps. */
export function createDriveClock() {
  let drive = 0, offset = 0, base = 0, engaged = false;
  return {
    get drive() { return drive; },
    get engaged() { return engaged; },
    engage(recordAngle) { offset = drive - recordAngle; engaged = true; return drive; },
    play(recordAngle) { if (engaged) drive = recordAngle + offset; return drive; },
    startMove() { base = drive; engaged = false; },
    moveTo(spinDeg) { drive = base + spinDeg; return drive; },
    release() { engaged = false; },
  };
}

const image = async (url) => { const i = new Image(); i.src = url; await i.decode(); return i; };

/** Loads the rendered drive layers and paints them on a canvas covering the drive region. */
export async function createDrivePainter(assets) {
  const response = await fetch(new URL('drive.json', assets));
  if (!response.ok) throw Error(`${response.status} drive.json`);
  const meta = await response.json();
  const load = (name) => image(new URL(name, assets));
  const [sheets, play, playOver, moves] = await Promise.all([
    Promise.all(meta.gears.map((g) => load(g.atlas))),
    load(meta.play.background),
    meta.play.overlay ? load(meta.play.overlay) : null,
    Promise.all(Object.entries(meta.moves).map(async ([kind, m]) => [kind, { ...m, bg: await load(m.background), over: await load(m.overlay) }])),
  ]);
  const move = Object.fromEntries(moves);
  const { region } = meta;
  const canvas = document.createElement('canvas');
  canvas.className = 'engineering-drive';
  canvas.width = region.w; canvas.height = region.h;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { left: `${region.x / 7.68}%`, top: `${region.y / 4.32}%`, width: `${region.w / 7.68}%`, height: `${region.h / 4.32}%` });
  const ctx = canvas.getContext('2d');
  let last = '';
  function gears(drive) {
    meta.gears.forEach((g, n) => {
      const { k, residual } = spriteFrame(gearAngle(drive, g.teeth), g.frames), [w, h] = g.cell, [px, py] = g.pivot;
      ctx.save();
      ctx.translate(g.origin[0] + px, g.origin[1] + py);
      if (residual) ctx.rotate(residual * Math.PI / 180);
      ctx.drawImage(sheets[n], (k % g.cols) * w, Math.floor(k / g.cols) * h, w, h, -px, -py, w, h);
      ctx.restore();
    });
  }
  /** kind: 'play' (record on the platter or empty deck) or 'load'/'eject' with the plate frame index. */
  function paint(kind, index, drive) {
    const key = `${kind}:${index}:${drive.toFixed(3)}`;
    if (key === last) return false;
    last = key;
    ctx.clearRect(0, 0, region.w, region.h);
    const m = move[kind];
    if (m) ctx.drawImage(m.bg, (index % m.cols) * region.w, Math.floor(index / m.cols) * region.h, region.w, region.h, 0, 0, region.w, region.h);
    else ctx.drawImage(play, 0, 0);
    gears(drive);
    // Moving arm, gate and carried record pass in front of the gears; static parts are cut out of the gear frames.
    const [x, y, w, h] = m ? m.boxes[index] : meta.play.overlayBox;
    if (w && h) ctx.drawImage(m ? m.over : playOver, m ? m.offsets[index] : 0, 0, w, h, x, y, w, h);
    return true;
  }
  return { canvas, paint, meta, files: [meta.play.background, meta.play.overlay, ...meta.gears.map((g) => g.atlas), ...Object.values(meta.moves).flatMap((m) => [m.background, m.overlay])].filter(Boolean) };
}
