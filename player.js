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
import { getEngine, getLevels } from './audio.js';
import { getCachedBlob } from './crates.js';
import { createVinylSurface } from './vinyl.js';

// The last moments of every song fade to silence over this long, so the
// record-changer animation can swap discs without a hard cut.
const TAIL_FADE_SEC = 1.2;

function makeDeck(engine) {
  const audio = new Audio();
  audio.preload = 'auto';
  const source = engine.ctx.createMediaElementSource(audio);
  const gain = engine.ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(engine.musicBus);
  const vinyl = createVinylSurface(engine.ctx, engine.recordBus);
  engine.recordSurfaces.add(vinyl);
  return { audio, gain, vinyl, needlePending: false, fadeInMs: 350, leadIn: null,
    trackId: null, tailArmed: false, killTimer: null, objectUrl: null, ready: Promise.resolve(), loadToken: 0 };
}

export function createPlayer(handlers = {}) {
  const engine = getEngine();
  if (!engine) throw new Error('Audio is not unlocked yet');
  const { ctx } = engine;
  const decks = [makeDeck(engine), makeDeck(engine)];
  let active = 0;

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
    audio.addEventListener('playing', () => {
      if (i !== active) { audio.pause(); return; }
      if (audio.paused || audio.ended) return;
      // The browser really has audio to play: loading and buffering are silent.
      if (deck.tailArmed && Number.isFinite(audio.duration)) {
        rampGain(deck, 0, Math.max(0, audio.duration - audio.currentTime) * 1000);
      } else rampGain(deck, 1, deck.fadeInMs);
      deck.vinyl.start({ needle: deck.needlePending });
      deck.needlePending = false;
    });
    for (const event of ['pause', 'waiting', 'ended', 'error', 'emptied']) {
      audio.addEventListener(event, () => {
        // During the lead-in the media is not playing yet: its own load settling
        // must not lift the needle. Only a broken file ends the lead-in early.
        if (deck.leadIn && event !== 'error') return;
        endLeadIn(deck, 'cancelled');
        deck.vinyl.stop();
      });
    }
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
      if (!deck.tailArmed && !audio.paused && Number.isFinite(duration)) {
        const remaining = duration - audio.currentTime;
        if (remaining <= TAIL_FADE_SEC && remaining > 0.05) {
          deck.tailArmed = true;
          rampGain(deck, 0, remaining * 1000);
        }
      }
    });
  });

  /* The needle rides the lead-in groove before the music: crackle only.
     Resolves 'play' when the music should start, 'held' if paused meanwhile,
     'cancelled' if skipped or replaced. */
  function leadIn(deck, ms) {
    return new Promise((resolve) => {
      deck.leadIn = { resolve, timer: setTimeout(() => { deck.leadIn = null; resolve('play'); }, ms) };
    });
  }

  function endLeadIn(deck, outcome) {
    if (!deck.leadIn) return false;
    clearTimeout(deck.leadIn.timer);
    deck.leadIn.resolve(outcome);
    deck.leadIn = null;
    deck.vinyl.stop();
    return true;
  }

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
       stopped. With leadInMs, the needle drops and the record crackles that
       long before the music (skipped when vinyl is muted); needle: false starts
       the music with no needle drop (the night's opener, in the dark). Resolves true if
       audio started (or was paused during the lead-in), false if replaced or
       if the browser or the file refused (onError is also called). */
    async start(track, { fadeInMs = 350, leadInMs = 0, needle = true } = {}) {
      const old = activeDeck();
      endLeadIn(old, 'cancelled');
      if (!old.audio.paused) {
        rampGain(old, 0, 60);
        old.killTimer = setTimeout(() => { old.audio.pause(); old.killTimer = null; }, 90);
      }
      active = 1 - active;
      const deck = activeDeck();
      if (deck.killTimer) { clearTimeout(deck.killTimer); deck.killTimer = null; }
      const loading = load(deck, track);
      deck.tailArmed = false;
      deck.needlePending = needle;
      deck.fadeInMs = fadeInMs;
      const { g, now } = holdGain(deck);
      g.setValueAtTime(0.0001, now);
      try {
        await loading;
        const stale = () => deck !== activeDeck() || deck.trackId !== track.id;
        if (stale()) return false;                    // pre-empted by a newer choice
        const { sfx, vinyl } = getLevels();
        if (leadInMs > 0 && sfx * vinyl > 0) {
          deck.vinyl.start({ needle: true });
          deck.needlePending = false;
          const outcome = await leadIn(deck, leadInMs);
          if (outcome === 'held') { deck.needlePending = true; return true; }
          if (outcome === 'cancelled' || stale()) return false;
        }
        await deck.audio.play();
        return true;
      } catch (err) {
        deck.vinyl.stop();
        handlers.onError?.(track.id, err);
        return false;
      }
    },

    /* Fade the playing song out (skip). Resolves when it is silent. */
    fadeOut(ms = 250) {
      const deck = activeDeck();
      endLeadIn(deck, 'cancelled');
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

    /* Start the current song again from the top (BACK pressed late in a song). */
    restart() {
      const deck = activeDeck();
      if (!deck.trackId || deck.leadIn) return;      // still in the lead-in: already at the top
      deck.tailArmed = false;
      try { deck.audio.currentTime = 0; } catch { /* not seekable yet */ }
      if (!deck.audio.paused) {
        rampGain(deck, 1, 60);
        deck.vinyl.scratch();
      } else deck.needlePending = true;
    },

    pause() {
      const deck = activeDeck();
      if (endLeadIn(deck, 'held')) return;
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
      deck.fadeInMs = 160;
      // A quick second press can cancel pause's fade before pause() reaches the
      // media element. play() then emits no new `playing` event: restore gain now.
      if (!deck.audio.paused) rampGain(deck, 1, deck.fadeInMs);
      try { await deck.audio.play(); return true; } catch (err) {
        deck.vinyl.stop();
        handlers.onError?.(deck.trackId, err);
        return false;
      }
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
async function probeTrack(url, timeoutMs = 20000) {
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
