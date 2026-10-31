/* Keep the complete track list at its natural, readable height. Artwork gets
   the remaining space, beside the album controls or above them if that is bigger. */
export function planRackLayout({
  width, height, tracksHeight, controlsWidth, controlsHeight, listGap, coverGap,
  // The controls sit on one compact row when the cover is above them.
  stackedControlsHeight = controlsHeight,
}) {
  const room = Math.max(0, height - tracksHeight - listGap - 2);
  const beside = room >= controlsHeight ? Math.max(0, Math.min(room, width - controlsWidth - coverGap)) : 0;
  const above = Math.max(0, Math.min(width, room - stackedControlsHeight - coverGap));
  // Round down, so subpixel rounding cannot push the final strip out of view.
  const coverSize = Math.floor(Math.max(beside, above) * 2) / 2;
  const layout = coverSize === 0 ? 'none' : above > beside ? 'stacked' : 'beside';
  return { layout, coverSize };
}

const px = (value) => Number.parseFloat(value) || 0;
const boxHeight = (element) => {
  const css = getComputedStyle(element);
  return px(css.height) + px(css.marginTop) + px(css.marginBottom);
};

export function fitRackArtwork({ panel, heading, controls, strips }) {
  let frame = 0;
  let rows = [];
  const measure = () => {
    frame = 0;
    const listCss = getComputedStyle(strips);
    const tracksHeight = rows.reduce((sum, row) => sum + boxHeight(row), 0)
      + px(listCss.paddingTop) + px(listCss.paddingBottom)
      + px(listCss.borderTopWidth) + px(listCss.borderBottomWidth);
    const bar = controls.querySelector('.rack-bar');
    const label = controls.querySelector('.rack-label');
    const summary = controls.querySelector('.rack-summary');
    const labelCss = getComputedStyle(label);
    const barCss = getComputedStyle(bar);
    const summaryCss = getComputedStyle(summary);
    const sumWidths = (elements) => [...elements].reduce((sum, node) => sum + px(getComputedStyle(node).width), 0);
    // Measure the actual navigation and font metrics rather than hardcoding a
    // cover cap for a particular album title, screen ratio or browser zoom.
    const labelWidth = sumWidths(label.children) + px(labelCss.columnGap) * Math.max(0, label.children.length - 1);
    const navButtons = [...bar.querySelectorAll('.rack-nav')].filter((node) => getComputedStyle(node).display !== 'none');
    // The arrow keys stretch to fill their row, so only their minimum size (not
    // their current stretched size) says how much room the controls really need.
    const navMinWidth = Math.max(0, ...navButtons.map((node) => px(getComputedStyle(node).minWidth)));
    const navMinHeight = Math.max(0, ...navButtons.map((node) => px(getComputedStyle(node).minHeight)));
    const navWidth = Math.max(labelWidth, navMinWidth * navButtons.length + px(barCss.columnGap) * Math.max(0, navButtons.length - 1));
    const summaryWidth = sumWidths(summary.children) + px(summaryCss.columnGap)
      + px(summaryCss.paddingLeft) + px(summaryCss.paddingRight);
    const controlsGap = px(getComputedStyle(controls).rowGap);
    const controlsHeight = boxHeight(label) + navMinHeight + px(barCss.rowGap) + boxHeight(summary) + controlsGap;
    const stackedControlsHeight = Math.max(boxHeight(label), navMinHeight) + boxHeight(summary) + controlsGap;
    const layout = planRackLayout({
      width: panel.clientWidth,
      height: panel.clientHeight,
      tracksHeight,
      controlsWidth: Math.max(navWidth, summaryWidth),
      controlsHeight,
      stackedControlsHeight,
      listGap: px(getComputedStyle(panel).rowGap),
      coverGap: px(getComputedStyle(heading).columnGap),
    });
    if (heading.dataset.layout !== layout.layout) heading.dataset.layout = layout.layout;
    const size = `${layout.coverSize}px`;
    if (heading.style.getPropertyValue('--rack-cover-size') !== size) heading.style.setProperty('--rack-cover-size', size);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(panel);
  observer?.observe(controls);
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule).catch(() => {});
  return {
    refresh() {
      rows.forEach((row) => observer?.unobserve(row));
      rows = [...strips.children];
      rows.forEach((row) => observer?.observe(row));
      // An album with more tracks must release cover space before its first
      // paint, including when the window is in the background.
      if (frame) cancelAnimationFrame(frame);
      measure();
    },
  };
}
