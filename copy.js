/* ============================================================
   COPY - every line of rotating text on the jukebox, held as a big
   pool so nothing goes stale over a three-hour night.

   Rules for adding lines (the tests check these):
   - ALL CAPS, plain letters, no longer than 64 characters (the LED
     ticker has to be readable from the back of the rink).
   - Warm, wholesome, playful. Church-family friendly.
   - Never repeat a line inside one pool.

   createRotator() deals the lines out like a shuffled deck: every line
   is used once before any repeats, and the same line never appears twice
   in a row. Callers pick ONCE and HOLD the line (the way trivia holds
   its roasts) so text never flickers on a re-draw.

   Pure strings and functions - no page needed - so tests run in Node.
   ============================================================ */

/* The power-on self-test. t = what is being checked, s = the result,
   k = colour: ok (green), warn (gold), bad (pink - the funny failures). */
export const BOOT_POOL = [
  { t: 'TONEARM CALIBRATION',        s: 'OK',      k: 'ok' },
  { t: 'WHEEL BEARINGS LUBED',       s: 'OK',      k: 'ok' },
  { t: 'BUBBLE TUBES FILLED',        s: 'OK',      k: 'ok' },
  { t: 'NEEDLE DUSTED',              s: 'OK',      k: 'ok' },
  { t: 'MIRROR BALL POLISHED',       s: 'OK',      k: 'ok' },
  { t: 'DISCO LIGHTS WARMED UP',     s: 'OK',      k: 'ok' },
  { t: 'COIN SLOT UNJAMMED',         s: 'OK',      k: 'ok' },
  { t: 'VINYL FLATTENED',            s: 'OK',      k: 'ok' },
  { t: 'RECORD CRATES SORTED',       s: 'OK',      k: 'ok' },
  { t: 'NEON TUBES TUNED',           s: 'OK',      k: 'ok' },
  { t: 'BASS BINS WOKEN UP',         s: 'OK',      k: 'ok' },
  { t: 'RINK FLOOR WAXED',           s: 'OK',      k: 'ok' },
  { t: 'SKATE LACES TIED',           s: 'OK',      k: 'ok' },
  { t: 'WARMING UP THE DANCE FLOOR', s: 'OK',      k: 'ok' },
  { t: 'SNACK BAR STOCKED',          s: 'OK',      k: 'ok' },
  { t: 'TEACHING ROBOTS TO ROLL',    s: 'OK',      k: 'ok' },
  { t: 'WAKING THE CHROME BAND',     s: 'OK',      k: 'ok' },
  { t: 'CHECKING WHEELS ARE ROUND',  s: 'OK',      k: 'ok' },
  { t: 'DISCO TWIRLS PERMITTED',     s: 'YES',     k: 'ok' },
  { t: 'SHUFFLING THE PLAYLIST',     s: 'OK',      k: 'ok' },
  { t: 'COUNTING WOBBLY SKATERS',    s: 'SEVERAL', k: 'warn' },
  { t: 'WALL HUGGERS DETECTED',      s: 'PLENTY',  k: 'warn' },
  { t: 'BACKWARDS SKATERS SPOTTED',  s: '3',       k: 'warn' },
  { t: 'GROOVE LEVEL',               s: 'MAX',     k: 'warn' },
  { t: 'SYNTH TO MACHINE RATIO',     s: 'PERFECT', k: 'warn' },
  { t: 'FALLS SO FAR',               s: '0',       k: 'warn' },
  { t: 'LOCATING LOST MITTEN',       s: '404',     k: 'bad' },
  { t: 'FINDING THE SKATE KEY',      s: 'NOPE',    k: 'bad' },
  { t: 'CHECKING FOR ODD SOCKS',     s: 'FOUND',   k: 'bad' },
  { t: 'AVOIDING THE RAILING',       s: 'FAILED',  k: 'bad' },
];

/* The scrolling LED ticker. Mixed in with NOW PLAYING / UP NEXT. */
export const TICKER_LINES = [
  'WELCOME TO SKATE NIGHT',
  'PICK A SONG ON THE KEYPAD AND PRESS SELECT',
  'RFAI - SYNTHS, MACHINES, MUSIC, FOREVER',
  'KEEP TO THE RIGHT AND STAY ON YOUR WHEELS',
  'NOTHING IN THE QUEUE? THE HOUSE PICKS THE NEXT ONE',
  'REMEMBER TO BEND YOUR KNEES',
  'FALLING IS PART OF THE FUN - GET BACK UP!',
  'THE SNACK BAR IS OPEN',
  'BE KIND, BE SAFE, BE STEADY',
  'FIRST TIME ON SKATES? ASK A FRIEND FOR A HAND',
  'MORE VINYL, MORE FUN, MORE ROLLING',
  'WHEELS DOWN, HEARTS UP',
  'GOOD TIMES ROLL IN GOOD COMPANY',
  'THIS MACHINE RUNS ON JOY AND CHROME',
  'KEEP YOUR EYES UP AND YOUR SMILE ON',
  'THANK YOU FOR SKATING WITH US TONIGHT',
  'SLOW DOWN FOR OUR LITTLE SKATERS',
  'PLAYLISTS BY ROBOTS, SMILES BY YOU',
  'STEREO HI-FI SPECIAL - 33 1/3 R.P.M.',
  'COVER BANDS DO NOT GET TIRED - SKATERS DO, SO REST UP',
];

/* The rink announcer, one call at a time. */
export const ANNOUNCER_QUIPS = [
  'ALL SKATE!',
  'COUPLES SKATE - GRAB A FRIEND',
  'REVERSE DIRECTION!',
  'WATCH OUT FOR WOBBLY SKATERS!',
  'SPEED SKATERS TO THE OUTSIDE LANE',
  'BEGINNERS WELCOME ON THE INSIDE',
  'CONGA LINE ON WHEELS!',
  'BACKWARDS SKATE - IF YOU DARE!',
  'LIMBO SKATE! HOW LOW CAN YOU GO?',
  'HOKEY POKEY ON WHEELS!',
  'SNOWBALL SKATE - TAP A FRIEND TO JOIN!',
  'FAMILY SKATE - BRING THE LITTLE ONES!',
  'TRAIN SKATE - HOLD THE SKATER IN FRONT!',
  'CROSSOVERS ON THE CORNERS!',
  'KEEP THOSE KNEES BENT!',
  'ANOTHER LAP! ANOTHER LAP!',
  'HANDS UP IF YOU ARE HAVING FUN!',
  'HIGH FIVES AT THE NEXT CORNER!',
  'SHOW US YOUR BEST SPIN!',
  'SKATE WITH SOMEONE NEW!',
  'CHEER FOR OUR BRAVE FIRST-TIMERS!',
  'LIGHTS DOWN, MUSIC UP!',
  'GROOVE THROUGH THE CORNERS!',
  'EVERYBODY WAVE TO THE DJ!',
];

/* Shown while the machine waits for someone to use it. */
export const ATTRACT_LINES = [
  'INSERT COIN TO BEGIN',
  'PRESS ANY KEY TO START THE NIGHT',
  'ONE PLAYER OR ONE HUNDRED SKATERS',
  'PICK A SONG - BE THE DJ',
  'RFAI PRESENTS SKATE NIGHT',
  'TODAY ONLY - SPECIAL BUY: GOOD TIMES',
  'USED VINYL - LOVED BY MANY',
  '33 1/3 R.P.M. OF PURE FUN',
  'SYNTHS - MACHINES - MUSIC - FOREVER',
  'STEREO HI-FI SKATING',
  'WHO WILL PICK THE NEXT SONG?',
  'TYPE A CODE LIKE A1 AND PRESS SELECT',
  'PLAYER ONE: READY',
  'FREE PLAY - NO COINS NEEDED',
];

/* Said when a song cannot be played (its MP3 file is missing). */
export const OUT_OF_ORDER_LINES = [
  'SORRY, THAT RECORD IS OUT OF ORDER',
  'OUT OF ORDER - TRY ANOTHER ONE',
  'THAT ONE IS TAKING A NAP - PICK ANOTHER',
  'THAT RECORD IS STUCK IN THE CRATE',
  'OUT OF ORDER - THE ROBOTS ARE ON IT',
  'NO LUCK - THAT TRACK IS MISSING',
  'THAT SLEEVE IS EMPTY - PICK ANOTHER',
  'TECHNICAL DIFFICULTIES - TRY A DIFFERENT SONG',
  'THAT ONE WENT ROLLING OFF - PICK ANOTHER',
  'OUT OF ORDER - TELL BEN AFTER THE SONG',
  'RECORD NOT FOUND - TRY ANOTHER CODE',
  'THIS TRACK IS ON A BREAK',
];

/* ---------------------------------------------------------------
   Helpers
   --------------------------------------------------------------- */

/* A random handful, chosen without repeats. Does not touch the original. */
export function sample(arr, n, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/* Deals lines like a shuffled deck. Call the returned function for the next
   line. Every line is used once before any repeats, and the same line is
   never dealt twice in a row (even across a reshuffle). */
export function createRotator(pool, rng = Math.random) {
  let bag = [];
  let last = null;
  return function next() {
    if (pool.length === 0) return '';
    if (bag.length === 0) {
      bag = sample(pool, pool.length, rng);
      if (pool.length > 1 && bag[bag.length - 1] === last) {
        // lines are dealt from the end of the bag - swap so the repeat lands later
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    last = bag.pop();
    return last;
  };
}

/* Builds the long line the LED ticker scrolls: the live info first, then
   announcer calls and rink notices. */
export function composeTicker({ nowPlaying, upNext, quips }) {
  const parts = [];
  if (nowPlaying) parts.push(`NOW PLAYING: ${nowPlaying}`);
  if (upNext) parts.push(`UP NEXT: ${upNext}`);
  for (const q of quips || []) parts.push(q);
  return parts.join('   //   ');
}
