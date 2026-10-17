/* ============================================================
   TRACKS.JS - THE ONE FILE BEN EDITS BY HAND.

   Everything the jukebox plays is listed here. Nothing else needs touching
   to add songs. Read the three rules, then copy an example.

   THE THREE RULES
   1. Keep every  { ... },  exactly as the examples are - curly brackets,
      quote marks around the words, and a comma after the closing bracket.
      A missing comma or quote mark is the number one thing that breaks
      this file. (If you break it, the jukebox shows a warning and skips
      only the broken entry - it will not crash.)
   2. Lines starting with // are notes for humans. The computer ignores them.
   3. Do NOT type song lengths or selection codes. The jukebox reads the
      length from the MP3 itself and makes the codes (A1, A2, B1...) from
      the ORDER you list things in. Moving a song up or down the list
      changes its code.

   VOLUMES  (one per album cover)
     id      a short nickname, lower case, no spaces. Used by the songs below.
     title   what appears on screen, e.g. "Vol. V"
     cover   the picture file in the covers folder, e.g. "covers/vol-v.jpg"
             (if the picture is missing, the jukebox draws a plain sleeve)
     accent  the paint colour for this volume's sleeve and code chips.
             Pick ONE of:  "teal"  "mauve"  "gold"  "paper"  "sepia"

   Each volume gets a letter automatically, in the order listed:
   the first is A, the second B, the third C, and so on.

   TRACKS  (one per song)
     id      a short nickname, lower case, no spaces. Must be different for
             every song.
     title   what appears on screen
     volume  the id of the volume it belongs to (from the list above)
     file    the MP3 in the audio folder, e.g. "audio/rolling-thunder.mp3"
             The name must match the real file EXACTLY, capitals included.

   If a file is missing or misnamed, that song shows OUT OF ORDER and is
   skipped. Nothing else is affected.
   ============================================================ */

export const volumes = [
  // Example volumes - change these to match your real covers.
  { id: 'vol-iii', title: 'Vol. III', cover: 'covers/vol-iii.jpg', accent: 'gold' },
  { id: 'vol-v',   title: 'Vol. V',   cover: 'covers/vol-v.jpg',   accent: 'teal' },
  { id: 'vol-ix',  title: 'Vol. IX',  cover: 'covers/vol-ix.jpg',  accent: 'mauve' },
];

export const tracks = [
  // Example songs - replace with your real ones. These three point at MP3
  // files that do not exist yet, so they will show OUT OF ORDER until you
  // add real files with these exact names (or change the names below).

  // Becomes code A1 (first song of the first volume)
  { id: 'example-one',   title: 'Example Song One',   volume: 'vol-iii', file: 'audio/example-one.mp3' },

  // Becomes code B1 (first song of the second volume)
  { id: 'example-two',   title: 'Example Song Two',   volume: 'vol-v',   file: 'audio/example-two.mp3' },

  // Becomes code C1 (first song of the third volume)
  { id: 'example-three', title: 'Example Song Three', volume: 'vol-ix',  file: 'audio/example-three.mp3' },
];
