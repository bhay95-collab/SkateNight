/* ============================================================
   ARCH - the cabinet's crown. A chrome rail rises out of each side
   bubble tube, runs up beside the ticker and arches over the top,
   passing behind the marquee sign, so the whole screen reads as the
   outline of a classic jukebox - the same arch, lined with the same
   amber bulbs, as the cabinet in the INSERT COIN film. Drawn as one SVG
   path, measured from the real tube positions (so it fits any screen)
   and redrawn on resize; the bulbs are round dashes along it (CSS).
   ============================================================ */
const NS = 'http://www.w3.org/2000/svg';

export function mountArch(svg, { rig, tubes, cabinet }) {
  if (!svg || !rig || !cabinet || tubes.some((t) => !t)) return;
  const paths = ['arch-glass', 'arch-liquid', 'arch-shine', 'arch-bulbs'].map((cls) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    svg.append(p);
    return p;
  });

  function layout() {
    const r = rig.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const [l, rt] = tubes.map((t) => t.getBoundingClientRect());
    const xl = l.left + l.width / 2 - r.left;
    const xr = rt.left + rt.width / 2 - r.left;
    const yBottom = l.top - r.top + rem * 1.2;           // tucked behind the rounded tube tops
    const yTop = rem * 1.2;                              // the crown runs just inside the bezel
    const radius = Math.min(rem * 3.5, (xr - xl) / 2, (yBottom - yTop) * 0.9);
    const d = [
      `M ${xl} ${yBottom}`,
      `L ${xl} ${yTop + radius}`,
      `A ${radius} ${radius} 0 0 1 ${xl + radius} ${yTop}`,
      `L ${xr - radius} ${yTop}`,
      `A ${radius} ${radius} 0 0 1 ${xr} ${yTop + radius}`,
      `L ${xr} ${yBottom}`,
    ].join(' ');
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    svg.style.setProperty('--arch-w', `${Math.max(6, l.width * 0.6)}px`);
    for (const p of paths) p.setAttribute('d', d);
  }

  layout();
  window.addEventListener('resize', layout);
  if (document.fonts?.ready) document.fonts.ready.then(layout).catch(() => {});
}
