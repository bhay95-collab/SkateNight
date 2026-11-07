// Review-only film indicator. The production app silently falls back to the live cut when no verified film
// is saved, or when the browser cannot decode the film (VS Code's built-in browser has no AAC). The review
// says which one is playing, and holds a coin pressed while the approved film is still being verified.
// Production verification, storage and fallback are untouched. Loaded only with ?diagnostics.
const $ = (id) => document.getElementById(id);
const FILM_CODECS = 'video/mp4; codecs="avc1.64002a, mp4a.40.2"';

export function filmVerdict({ state, text, approvedSha, playable }) {
  if (!playable) return { tone: 'bad', label: 'FALLBACK · LIVE CUT', detail: 'This browser cannot decode the approved H.264/AAC film (VS Code’s preview has no AAC). Open this page in Google Chrome.' };
  if (state === 'checking') return { tone: 'wait', label: 'VERIFYING APPROVED FILM…', detail: 'A coin pressed now waits for the verified film.' };
  const sha = /SHA ([0-9A-F]{8})/.exec(text || '')?.[1];
  if (state === 'ready' && sha && approvedSha?.toUpperCase().startsWith(sha)) return { tone: 'ok', label: 'APPROVED FILM READY', detail: `The Song Inside · ${text.split(' — ').pop()}` };
  if (state === 'ready') return { tone: 'bad', label: 'FILM IS NOT THE APPROVED BUILD', detail: text };
  return { tone: 'bad', label: 'FALLBACK · LIVE CUT', detail: text || 'No verified film is saved for this address.' };
}

export function startFilmCheck() {
  const status = $('film-status'), attract = $('attract'), film = $('awakening-film');
  if (!status || !attract || !film) return null;
  const badge = document.createElement('output');
  badge.className = 'film-check';
  badge.setAttribute('role', 'status');
  badge.append(document.createElement('b'), document.createElement('small'));
  document.body.append(badge);
  const playable = Boolean(document.createElement('video').canPlayType(FILM_CODECS));
  let approvedSha = '', pressed = false, held = null;
  const verdict = () => filmVerdict({ state: status.dataset.state, text: status.textContent, approvedSha, playable });
  const set = ({ tone, label, detail }) => { badge.dataset.tone = tone; badge.firstChild.textContent = label; badge.lastChild.textContent = detail; };
  function show() {
    if (pressed) return;
    const v = verdict();
    set(v);
    if (held && v.tone !== 'wait') { const press = held; held = null; press(); }
  }
  fetch(new URL('../films/manifest.json', import.meta.url)).then((r) => r.json()).then((m) => { approvedSha = m.sha256; show(); })
    .catch((error) => console.warn('[film check]', error));
  new MutationObserver(show).observe(status, { attributes: true, childList: true, characterData: true, subtree: true });
  // A coin pressed while the film is verifying replays once the verdict is in (the launch download takes ~1 s locally).
  const hold = (event) => {
    if (pressed || attract.hidden || status.dataset.state !== 'checking' || !playable) return;
    event.stopImmediatePropagation(); event.preventDefault();
    held = () => attract.click();
  };
  attract.addEventListener('click', hold, true);
  window.addEventListener('keydown', (e) => { if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) hold(e); }, true);
  // What actually plays after the coin: the approved film, or the live cut.
  const started = (e) => {
    if (pressed || held || attract.hidden || e.altKey || ['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key)) return;
    pressed = true;
    setTimeout(() => {
      if (!film.paused && film.currentSrc) set({ ...verdict(), tone: 'ok', label: 'PLAYING · APPROVED FILM' });
      else set({ tone: 'bad', label: 'PLAYING · LIVE-CUT FALLBACK', detail: verdict().detail });
    }, 900);
  };
  attract.addEventListener('click', started);
  window.addEventListener('keydown', started);
  film.addEventListener('ended', () => { badge.dataset.done = ''; });
  show();
  return { badge, get verdict() { return { tone: badge.dataset.tone, label: badge.firstChild.textContent }; } };
}
