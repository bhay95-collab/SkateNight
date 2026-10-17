/* ============================================================
   CODES - turns the two lists in tracks.js into the jukebox's
   library, and works out each song's selection code (A1, A2, B1...).

   Pure JavaScript, no page needed, so the tests run it in Node.

   The rules, in plain English:
   - Every VOLUME gets one letter, in the order the volumes are listed.
   - Every TRACK gets a number inside its volume's letter, in the order
     the tracks are listed. So the first Vol. V song is B1 if Vol. V is
     the second volume in the list.
   - Anything broken (a typo in a volume name, a missing file name) is
     left out and reported in `problems`. The jukebox keeps running and
     shows the problems on screen so Ben can fix them. It never crashes.
   ============================================================ */

// Letters used for codes. Left out on purpose:
//   F and N - they are keyboard shortcuts (Fullscreen, Next).
//   I and O - from 10 metres away they look like the numbers 1 and 0.
export const CODE_LETTERS = 'ABCDEGHJKLMPQRSTUVWXYZ';

// The accent words Ben can write in tracks.js. Each one is a paint colour
// sampled for the sleeve material (see the --sl-* tokens in styles.css).
export const ACCENTS = ['teal', 'mauve', 'gold', 'rust', 'paper', 'sepia'];

const DEFAULT_ACCENT = 'gold';

const isText = (v) => typeof v === 'string' && v.trim().length > 0;

export function formatCode(letter, number) {
  return `${letter}${number}`;
}

/* Accepts what a person might type: "b7", " B 07 ", "A12".
   Returns { letter, number } or null. Number must be 1 or more. */
export function parseCode(text) {
  if (typeof text !== 'string') return null;
  const m = /^\s*([A-Za-z])\s*(\d{1,3})\s*$/.exec(text);
  if (!m) return null;
  const number = Number(m[2]);
  if (number < 1) return null;
  return { letter: m[1].toUpperCase(), number };
}

export function findTrackByCode(library, text) {
  const parsed = parseCode(text);
  if (!parsed || !library) return null;
  const code = formatCode(parsed.letter, parsed.number);
  return library.tracks.find((t) => t.code === code) || null;
}

/* Build the library. Never throws; bad entries become `problems`. */
export function buildLibrary(rawVolumes, rawTracks) {
  const problems = [];
  const volumes = [];
  const tracks = [];

  const volumeList = Array.isArray(rawVolumes) ? rawVolumes : [];
  const trackList = Array.isArray(rawTracks) ? rawTracks : [];

  volumeList.forEach((v, i) => {
    const where = `volumes entry #${i + 1}`;
    if (!v || typeof v !== 'object' || !isText(v.id) || !isText(v.title)) {
      problems.push(`${where} needs an id and a title - it was skipped.`);
      return;
    }
    if (volumes.some((x) => x.id === v.id)) {
      problems.push(`${where} ("${v.id}") repeats an id already used - it was skipped.`);
      return;
    }
    if (volumes.length >= CODE_LETTERS.length) {
      problems.push(`${where} ("${v.id}") is volume number ${volumes.length + 1}, but only ${CODE_LETTERS.length} code letters exist - it was skipped.`);
      return;
    }
    let accent = v.accent;
    if (!ACCENTS.includes(accent)) {
      problems.push(`Volume "${v.id}" has accent "${accent}". Use one of: ${ACCENTS.join(', ')}. Using gold for now.`);
      accent = DEFAULT_ACCENT;
    }
    volumes.push({
      id: v.id,
      title: v.title,
      cover: isText(v.cover) ? v.cover : '',
      accent,
      letter: CODE_LETTERS[volumes.length],
    });
  });

  const counters = new Map();
  trackList.forEach((t, i) => {
    const where = `tracks entry #${i + 1}`;
    if (!t || typeof t !== 'object') {
      problems.push(`${where} is not a { ... } entry - it was skipped.`);
      return;
    }
    if (!isText(t.id) || !isText(t.title) || !isText(t.file) || !isText(t.volume)) {
      problems.push(`${where} ("${t.id || t.title || '?'}") needs an id, title, volume and file - it was skipped.`);
      return;
    }
    if (tracks.some((x) => x.id === t.id)) {
      problems.push(`${where} repeats the id "${t.id}" - it was skipped. Every song needs its own id.`);
      return;
    }
    const volume = volumes.find((v) => v.id === t.volume);
    if (!volume) {
      problems.push(`${where} ("${t.id}") says volume "${t.volume}", which is not in the volumes list - it was skipped.`);
      return;
    }
    const number = (counters.get(volume.id) || 0) + 1;
    counters.set(volume.id, number);
    tracks.push({
      id: t.id,
      title: t.title,
      volume: volume.id,
      file: t.file,
      letter: volume.letter,
      number,
      code: formatCode(volume.letter, number),
    });
  });

  return { volumes, tracks, problems };
}
