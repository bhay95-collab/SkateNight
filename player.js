/* ============================================================
   PLAYER - the audio decks.

   Two <audio> elements (deck A and deck B) take turns. While one plays,
   the other quietly downloads the NEXT song, so when a song ends the next
   one starts within a heartbeat - that is the "gapless-feel".

   Each deck passes through its own volume knob (for fades) and then the
   shared music bus in audio.js, which is what the visuals listen to.

   This file never touches the screen. app.js tells it what to do and
   listens for the events below.
   ============================================================ */
import { getEngine } from './audio.js';
import { getCachedBlob } from './crates.js';

// The last moments of every song fade to silence over this long, so the
// record-changer animation can swap discs without a hard cut.
export const TAIL_FADE_SEC = 1.2;

function makeDeck(engine) {
  const audio = new Audio();
  audio.preload = 'auto';
  const source = engine.ctx.createMediaElementSource(audio);
  const gain = engine.ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(engine.musicBus);
  return { audio, gain, trackId: null, tailArmed: false, killTimer: null, objectUrl: null, ready: Promise.resolve(), loadToken: 0 };
}

export function createPlayer(handlers = {}) {
  const engine = getEngine();
  if (!engine) throw new Error('Audio is not unlocked yet');
  const { ctx } = engine;
  const decks = [makeDeck(engine), makeDeck(engine)];
  let active = 0;
  let tailFade = true;

  const activeDeck = () => decks[active];
  const idleDeck = () => decks[1 - active];

  const holdGain = (deck) => {
    const g = deck.gain.gain;
    const now = ctx.currentTime;
    const v = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(v, now);
    return { g, now };
  };

  function rampGain(deck, to, ms) {
    const { g, now } = holdGain(deck);
    g.linearRampToValueAtTime(to, now + Math.max(0.005, ms / 1000));
  }

  decks.forEach((deck, i) => {
    const { audio } = deck;
    audio.addEventListener('ended', () => {
      if (i === active && deck.trackId) handlers.onEnded?.(deck.trackId);
    });
    audio.addEventListener('error', () => {
      if (deck.trackId) handlers.onError?.(deck.trackId, audio.error);
    });
    audio.addEventListener('durationchange', () => {
      if (deck.trackId && Number.isFinite(audio.duration)) handlers.onDuration?.(deck.trackId, audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      if (i !== active || !deck.trackId) return;
      const duration = audio.duration;
      handlers.onTime?.(audio.currentTime, duration, deck.trackId);
      // arm the closing fade-out once, when the end is near
      if (tailFade && !deck.tailArmed && !audio.paused && Number.isFinite(duration)) {
        const remaining = duration - audio.currentTime;
        if (remaining <= TAIL_FADE_SEC && remaining > 0.05) {
          deck.tailArmed = true;
          rampGain(deck, 0, remaining * 1000);
        }
      }
    });
  });

  /* Point a deck at a song. If the song is saved on this laptop (LOAD THE
     CRATES) it plays from that copy via a Blob URL, so it needs no network and
     no service-worker tricks. Otherwise it streams from the site as normal.
     deck.ready resolves once the source is set. */
  function load(deck, track) {
    if (deck.trackId === track.id) return deck.ready;
    deck.trackId = track.id;
    deck.tailArmed = false;
    const token = ++deck.loadToken;
    deck.ready = (async () => {
      let src = track.file;
      let url = null;
      const blob = await getCachedBlob(track.file);
      if (blob) { url = URL.createObjectURL(blob); src = url; }
      if (token !== deck.loadToken) {                // a newer song was chosen meanwhile
        if (url) URL.revokeObjectURL(url);
        return;
      }
      const previous = deck.objectUrl;
      deck.objectUrl = url;
      deck.audio.src = src;
      deck.audio.load();
      if (previous) URL.revokeObjectURL(previous);   // let go of the last song's copy
    })();
    return deck.ready;
  }

  return {
    /* Start downloading a song on the idle deck so it is ready to go. */
    cue(track) {
      const deck = idleDeck();
      if (deck.killTimer) return;       // still fading the last song out
      load(deck, track);
    },

    /* Begin playing `track` now, fading in. Anything still playing is
       stopped. Resolves true if audio started, false if the browser or the
       file refused (onError is also called). */
    async start(track, { fadeInMs = 350 } = {}) {
      const old = activeDeck();
      if (!old.audio.paused) {
        rampGain(old, 0, 60);
        old.killTimer = setTimeout(() => { old.audio.pause(); old.killTimer = null; }, 90);
      }
      active = 1 - active;
      const deck = activeDeck();
      if (deck.killTimer) { clearTimeout(deck.killTimer); deck.killTimer = null; }
      const loading = load(deck, track);
      deck.tailArmed = false;
      const { g, now } = holdGain(deck);
      g.setValueAtTime(0.0001, now);
      g.linearRampToValueAtTime(1, now + fadeInMs / 1000);
      try {
        await loading;
        if (deck.trackId !== track.id) return false;   // pre-empted by a newer choice
        await deck.audio.play();
        return true;
      } catch (err) {
        handlers.onError?.(track.id, err);
        return false;
      }
    },

    /* Fade the playing song out (skip). Resolves when it is silent. */
    fadeOut(ms = 250) {
      const deck = activeDeck();
      if (deck.audio.paused) return Promise.resolve();
      rampGain(deck, 0, ms);
      return new Promise((resolve) => {
        if (deck.killTimer) clearTimeout(deck.killTimer);
        deck.killTimer = setTimeout(() => {
          deck.audio.pause();
          deck.killTimer = null;
          resolve();
        }, ms + 30);
      });
    },

    pause() {
      const deck = activeDeck();
      if (deck.audio.paused) return;
      rampGain(deck, 0, 120);
      if (deck.killTimer) clearTimeout(deck.killTimer);
      deck.killTimer = setTimeout(() => { deck.audio.pause(); deck.killTimer = null; }, 140);
    },

    async resume() {
      const deck = activeDeck();
      if (!deck.trackId) return false;
      if (deck.killTimer) { clearTimeout(deck.killTimer); deck.killTimer = null; }
      deck.tailArmed = false;
      rampGain(deck, 1, 160);
      try { await deck.audio.play(); return true; } catch (err) { handlers.onError?.(deck.trackId, err); return false; }
    },

    get isPlaying() { const a = activeDeck().audio; return !a.paused && !a.ended; },
    get currentTime() { return activeDeck().audio.currentTime; },
    get duration() { return activeDeck().audio.duration; },
    get currentTrackId() { return activeDeck().trackId; },
  };
}

/* Quietly ask an MP3 for its length (and whether it exists) without playing
   it. Used at start-up to fill in durations and spot missing files.
   Resolves { ok: true, duration }, { ok: false } (file missing/unreadable)
   or { ok: null } (took too long - treat as "unknown", still try it). */
export async function probeTrack(url, timeoutMs = 20000) {
  const blob = await getCachedBlob(url);
  const objectUrl = blob ? URL.createObjectURL(blob) : null;
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      a.removeAttribute('src');
      a.load();                    // lets the browser free the connection
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: null }), timeoutMs);
    a.addEventListener('loadedmetadata', () => finish({ ok: true, duration: a.duration }), { once: true });
    a.addEventListener('error', () => finish({ ok: false }), { once: true });
    a.src = objectUrl || url;
  });
}

/* Probe many files, a few at a time, reporting each as it arrives. */
export async function probeAll(tracks, onResult, concurrency = 2) {
  let i = 0;
  const worker = async () => {
    while (i < tracks.length) {
      const track = tracks[i++];
      const result = await probeTrack(track.file);
      onResult(track, result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tracks.length) }, worker));
}
