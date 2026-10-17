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
     accent  the paint colour for this volume's code chips and record label.
             Pick ONE of:  "teal"  "mauve"  "gold"  "rust"  "wine"  "paper"  "sepia"

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
  // All ten covers. The letter comes from this ORDER (F, I, N and O are skipped,
  // see "How the codes work" in the README):
  //   Vol. I = A    Vol. II = B    Vol. III = C    Vol. IV = D    Vol. V = E
  //   Vol. VI = G   Vol. VII = H   Vol. VIII = J   Vol. IX = K    Vol. X = L
  // Add Vol. XI at the END of this list (it becomes M) so no existing code changes.
  { id: 'vol-i',    title: 'Vol. I',    cover: 'covers/vol-i.jpg',    accent: 'sepia' },
  { id: 'vol-ii',   title: 'Vol. II',   cover: 'covers/vol-ii.jpg',   accent: 'rust' },
  { id: 'vol-iii',  title: 'Vol. III',  cover: 'covers/vol-iii.jpg',  accent: 'gold' },
  { id: 'vol-iv',   title: 'Vol. IV',   cover: 'covers/vol-iv.jpg',   accent: 'mauve' },
  { id: 'vol-v',    title: 'Vol. V',    cover: 'covers/vol-v.jpg',    accent: 'teal' },
  { id: 'vol-vi',   title: 'Vol. VI',   cover: 'covers/vol-vi.jpg',   accent: 'wine' },
  { id: 'vol-vii',  title: 'Vol. VII',  cover: 'covers/vol-vii.jpg',  accent: 'gold' },
  { id: 'vol-viii', title: 'Vol. VIII', cover: 'covers/vol-viii.jpg', accent: 'sepia' },
  { id: 'vol-ix',   title: 'Vol. IX',   cover: 'covers/vol-ix.jpg',   accent: 'mauve' },
  { id: 'vol-x',    title: 'Vol. X',    cover: 'covers/vol-x.jpg',    accent: 'teal' },
];

export const tracks = [
  // Songs 1-10: one per volume, so the codes are A1 B1 C1 D1 E1 G1 H1 J1 K1 L1
  // (F is skipped). To add more songs to a volume, add lines for it
  // anywhere in this list: the next one on Vol. I becomes A2, and so on.

  // A1 - Vol. I
  { id: 'according-to-his-power', title: 'According to His Power', volume: 'vol-i',   file: 'audio/according-to-his-power.mp3' },

  // B1 - Vol. II
  { id: 'bread-of-heaven',        title: 'Bread of Heaven',        volume: 'vol-ii',  file: 'audio/bread-of-heaven.mp3' },

  // C1 - Vol. III
  { id: 'by-his-knowledge',       title: 'By His Knowledge',       volume: 'vol-iii', file: 'audio/by-his-knowledge.mp3' },

  // D1 - Vol. IV
  { id: 'christ-lifted-up',       title: 'Christ Lifted Up',       volume: 'vol-iv',  file: 'audio/christ-lifted-up.mp3' },

  // E1 - Vol. V
  { id: 'come-unto-me',           title: 'Come Unto Me',           volume: 'vol-v',   file: 'audio/come-unto-me.mp3' },

  // G1 - Vol. VI
  { id: 'confess-and-believe',        title: 'Confess and Believe',            volume: 'vol-vi',   file: 'audio/confess-and-believe.mp3' },

  // H1 - Vol. VII
  { id: 'from-glory-to-glory',        title: 'From Glory to Glory',            volume: 'vol-vii',  file: 'audio/from-glory-to-glory.mp3' },

  // J1 - Vol. VIII
  { id: 'having-done-all-now-stand',  title: 'Having Done All, Now Stand',     volume: 'vol-viii', file: 'audio/having-done-all-now-stand.mp3' },

  // K1 - Vol. IX
  { id: 'he-who-began-a-good-work',   title: 'He Who Began a Good Work',       volume: 'vol-ix',   file: 'audio/he-who-began-a-good-work.mp3' },

  // L1 - Vol. X
  { id: 'it-is-good-to-sing-him-praises', title: 'It Is Good to Sing Him Praises', volume: 'vol-x', file: 'audio/it-is-good-to-sing-him-praises.mp3' },

  // ---- Songs 11-15: the second song on Vol. I to V ----

  // A2 - Vol. I
  { id: 'know-that-the-lord-psalm-4',      title: 'Know that the Lord - Psalm 4',     volume: 'vol-i',   file: 'audio/know-that-the-lord-psalm-4.mp3' },

  // B2 - Vol. II
  { id: 'let-your-holy-spirit-dwell-in-me', title: 'Let Your Holy Spirit Dwell in Me', volume: 'vol-ii',  file: 'audio/let-your-holy-spirit-dwell-in-me.mp3' },

  // C2 - Vol. III
  { id: 'lift-up-holy-hands',              title: 'Lift Up Holy Hands',               volume: 'vol-iii', file: 'audio/lift-up-holy-hands.mp3' },

  // D2 - Vol. IV
  { id: 'praise-lifted-on-high',           title: 'Praise Lifted On High',            volume: 'vol-iv',  file: 'audio/praise-lifted-on-high.mp3' },

  // E2 - Vol. V
  { id: 'praise-waits-for-you-psalm-65',   title: 'Praise Waits for You - Psalm 65',  volume: 'vol-v',   file: 'audio/praise-waits-for-you-psalm-65.mp3' },

  // ---- Songs 16-20: the second song on Vol. VI to X ----

  // G2 - Vol. VI
  { id: 'pray-without-ceasing',        title: 'Pray Without Ceasing',        volume: 'vol-vi',   file: 'audio/pray-without-ceasing.mp3' },

  // H2 - Vol. VII
  { id: 'prepare-the-way-of-the-lord', title: 'Prepare the Way of the Lord', volume: 'vol-vii',  file: 'audio/prepare-the-way-of-the-lord.mp3' },

  // J2 - Vol. VIII
  { id: 'proclaim-the-good-news',      title: 'Proclaim the Good News',      volume: 'vol-viii', file: 'audio/proclaim-the-good-news.mp3' },

  // K2 - Vol. IX
  { id: 'receive-with-meekness',       title: 'Receive with Meekness',       volume: 'vol-ix',   file: 'audio/receive-with-meekness.mp3' },

  // L2 - Vol. X
  { id: 'the-life-i-live',             title: 'The Life I Live',             volume: 'vol-x',    file: 'audio/the-life-i-live.mp3' },
];
