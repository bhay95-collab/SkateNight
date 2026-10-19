import test from 'node:test';
import assert from 'node:assert/strict';
import { planRackLayout } from '../rack-layout.js';

// These are the rack's measured dimensions after the surrounding cabinet has
// taken its space, rather than the dimensions of the entire browser window.
const rack = {
  width: 390,
  height: 430,
  tracksHeight: 7 * 36,
  controlsWidth: 210,
  controlsHeight: 62,
  listGap: 8,
  coverGap: 10,
};

test('a laptop rack puts its largest cover beside the controls and keeps all seven tracks', () => {
  assert.deepEqual(planRackLayout(rack), { layout: 'beside', coverSize: 168 });
});

test('a tall rack uses the full width for artwork above the controls', () => {
  assert.deepEqual(planRackLayout({ ...rack, height: 790 }), { layout: 'stacked', coverSize: 390 });
});

test('a wide rack uses spare horizontal space without giving away track space', () => {
  assert.deepEqual(planRackLayout({ ...rack, width: 680, height: 480 }), { layout: 'beside', coverSize: 218 });
});

test('a shorter album can have a larger cover in the same rack', () => {
  const longAlbum = planRackLayout(rack);
  const shortAlbum = planRackLayout({ ...rack, tracksHeight: 36 });
  assert.deepEqual(shortAlbum, { layout: 'stacked', coverSize: 312 });
  assert.ok(shortAlbum.coverSize > longAlbum.coverSize);
});

test('adding tracks reduces the cover by the room those tracks require', () => {
  const wideRack = { ...rack, width: 900, height: 530 };
  const threeTracks = planRackLayout({ ...wideRack, tracksHeight: 3 * 36 });
  const sixTracks = planRackLayout({ ...wideRack, tracksHeight: 6 * 36 });
  const sevenTracks = planRackLayout({ ...wideRack, tracksHeight: 7 * 36 });
  assert.equal(threeTracks.coverSize - sixTracks.coverSize, 3 * 36);
  assert.equal(sixTracks.coverSize - sevenTracks.coverSize, 36);
  assert.equal(sevenTracks.layout, 'beside');
});

test('the cover disappears when there is no room beyond the complete list and controls', () => {
  const narrowRack = { ...rack, width: rack.controlsWidth, height: rack.tracksHeight + rack.listGap + 2 + rack.controlsHeight };
  assert.deepEqual(planRackLayout(narrowRack), { layout: 'none', coverSize: 0 });
  assert.deepEqual(planRackLayout({ ...rack, height: rack.tracksHeight - 1 }), { layout: 'none', coverSize: 0 });
});

test('zero-size and empty-list constraints produce finite sizes without inventing artwork room', () => {
  const empty = { width: 0, height: 0, tracksHeight: 0, controlsWidth: 0, controlsHeight: 0, listGap: 0, coverGap: 0 };
  assert.deepEqual(planRackLayout(empty), { layout: 'none', coverSize: 0 });
  assert.deepEqual(planRackLayout({ ...rack, width: 0 }), { layout: 'none', coverSize: 0 });
  assert.deepEqual(planRackLayout({ ...rack, height: 0 }), { layout: 'none', coverSize: 0 });
  assert.deepEqual(planRackLayout({ ...empty, width: 100, height: 200, controlsWidth: 40, controlsHeight: 30, coverGap: 10 }), {
    layout: 'stacked', coverSize: 100,
  });
});

test('fractional measurements round the artwork down and retain room for the final strip', () => {
  const dimensions = { ...rack, width: 390.75, height: 430.3, tracksHeight: 252.1, listGap: 8.1 };
  const result = planRackLayout(dimensions);
  assert.equal(result.coverSize, 168);
  assert.ok(result.coverSize + dimensions.tracksHeight + dimensions.listGap + 2 <= dimensions.height);
});

test('subpixel scraps of room hide artwork instead of leaving an empty cover gap', () => {
  const dimensions = { ...rack, width: rack.controlsWidth + rack.coverGap + 0.4, height: rack.tracksHeight + rack.listGap + 2 + rack.controlsHeight };
  assert.deepEqual(planRackLayout(dimensions), { layout: 'none', coverSize: 0 });
});

// Check the physical constraints independently of the planner's calculation.
// The final two pixels protect the final track from browser subpixel rounding.
function fits(dimensions, layout, size) {
  const { width, height, controlsWidth, controlsHeight, tracksHeight, listGap, coverGap } = dimensions;
  const headingHeight = layout === 'stacked'
    ? size + coverGap + controlsHeight
    : Math.max(size, controlsHeight);
  const headingWidth = layout === 'beside' ? size + coverGap + controlsWidth : Math.max(size, controlsWidth);
  return headingWidth <= width && headingHeight + tracksHeight + listGap + 2 <= height;
}

test('artwork is the largest feasible half-pixel square while the complete list remains reserved', () => {
  let checked = 0;
  for (const width of [280, 390, 680]) {
    for (const height of [320, 430, 790]) {
      for (const tracks of [0, 1, 4, 7, 12]) {
        const dimensions = { ...rack, width, height, tracksHeight: tracks * 36 };
        const result = planRackLayout(dimensions);
        assert.ok(Number.isFinite(result.coverSize));
        assert.ok(result.coverSize >= 0);
        assert.equal(result.coverSize * 2, Math.floor(result.coverSize * 2));

        if (result.coverSize > 0) {
          assert.ok(fits(dimensions, result.layout, result.coverSize), JSON.stringify({ dimensions, result }));
        } else if (dimensions.controlsHeight + dimensions.tracksHeight + dimensions.listGap + 2 <= height) {
          assert.equal(result.layout, 'none');
        }

        // Any larger square must fail both arrangements. Testing every larger
        // half-pixel candidate also catches a size cap that wastes tall space.
        for (let candidate = result.coverSize + 0.5; candidate <= width; candidate += 0.5) {
          assert.ok(!fits(dimensions, 'beside', candidate), `A larger cover fits beside: ${JSON.stringify({ dimensions, result, candidate })}`);
          assert.ok(!fits(dimensions, 'stacked', candidate), `A larger cover fits above: ${JSON.stringify({ dimensions, result, candidate })}`);
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 45);
});
