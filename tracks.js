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
  // All ten covers. The letter comes from this ORDER (F, I, N, O, P and S are skipped,
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

  // ---- Songs 21-25: the third song on Vol. I to V ----

  // A3 - Vol. I
  { id: 'the-new-and-living-way',   title: 'The New and Living Way',   volume: 'vol-i',   file: 'audio/the-new-and-living-way.mp3' },

  // B3 - Vol. II
  { id: 'the-power-is-in-the-word', title: 'The Power Is in the Word', volume: 'vol-ii',  file: 'audio/the-power-is-in-the-word.mp3' },

  // C3 - Vol. III
  { id: 'the-way-of-salvation',     title: 'The Way of Salvation',     volume: 'vol-iii', file: 'audio/the-way-of-salvation.mp3' },

  // D3 - Vol. IV
  { id: 'there-is-a-way',           title: 'There Is a Way',           volume: 'vol-iv',  file: 'audio/there-is-a-way.mp3' },

  // E3 - Vol. V
  { id: 'to-those-who-believe',     title: 'To Those Who Believe',     volume: 'vol-v',   file: 'audio/to-those-who-believe.mp3' },

  // ---- Songs 26-27: the third song on Vol. VI and VII ----

  // G3 - Vol. VI
  { id: 'we-have-a-hope-in-jesus', title: 'We Have a Hope in Jesus', volume: 'vol-vi',  file: 'audio/we-have-a-hope-in-jesus.mp3' },

  // H3 - Vol. VII
  { id: 'you-are-worthy-o-lord',  title: 'You Are Worthy, O Lord',  volume: 'vol-vii', file: 'audio/you-are-worthy-o-lord.mp3' },

  // ---- Songs 28-29: the third song on Vol. VIII and IX ----

  // J3 - Vol. VIII
  { id: 'remember-the-heights',        title: 'Remember the Heights',        volume: 'vol-viii', file: 'audio/remember-the-heights.mp3' },

  // K3 - Vol. IX
  { id: 'doing-away-with-my-religion', title: 'Doing Away With My Religion', volume: 'vol-ix',   file: 'audio/doing-away-with-my-religion.mp3' },

  // ---- Songs 30-34: Vol. X gets its third, then a fourth song on Vol. I - IV ----

  // L3 - Vol. X
  { id: 'we-have-come',          title: 'We Have Come',          volume: 'vol-x',   file: 'audio/we-have-come.mp3' },

  // A4 - Vol. I
  { id: 'fire-flame-of-jehovah', title: 'Fire-Flame of Jehovah', volume: 'vol-i',   file: 'audio/fire-flame-of-jehovah.mp3' },

  // B4 - Vol. II
  { id: 'love-that-lifts-me-up', title: 'Love that Lifts Me Up', volume: 'vol-ii',  file: 'audio/love-that-lifts-me-up.mp3' },

  // C4 - Vol. III
  { id: 'pressing-on',           title: 'Pressing On',           volume: 'vol-iii', file: 'audio/pressing-on.mp3' },

  // D4 - Vol. IV
  { id: 'shine-in-our-hearts',   title: 'Shine in Our Hearts',   volume: 'vol-iv',  file: 'audio/shine-in-our-hearts.mp3' },

  // ---- Songs 35-39: a fourth song on Vol. V - IX ----

  // E4 - Vol. V
  { id: 'where-are-the-eagles',        title: 'Where Are the Eagles',        volume: 'vol-v',    file: 'audio/where-are-the-eagles.mp3' },

  // G4 - Vol. VI
  { id: 'coming-alive',                title: 'Coming Alive',                volume: 'vol-vi',   file: 'audio/coming-alive.mp3' },

  // H4 - Vol. VII
  { id: 'holding-on',                  title: 'Holding On',                  volume: 'vol-vii',  file: 'audio/holding-on.mp3' },

  // J4 - Vol. VIII
  { id: 'rejoice-in-the-lord-always',  title: 'Rejoice in the Lord Always',  volume: 'vol-viii', file: 'audio/rejoice-in-the-lord-always.mp3' },

  // K4 - Vol. IX
  { id: 'the-word-is-a-lighthouse',    title: 'The Word Is a Lighthouse',    volume: 'vol-ix',   file: 'audio/the-word-is-a-lighthouse.mp3' },

  // ---- Songs 40-44: a fourth song on Vol. X, then a fifth on Vol. I - IV ----

  // L4 - Vol. X
  { id: 'god-be-thanked',      title: 'God Be Thanked',      volume: 'vol-x',   file: 'audio/god-be-thanked.mp3' },

  // A5 - Vol. I
  { id: 'the-shepherds-song',  title: "The Shepherd's Song", volume: 'vol-i',   file: 'audio/the-shepherds-song.mp3' },

  // B5 - Vol. II
  { id: 'you-are-the-lord',    title: 'You Are the Lord',    volume: 'vol-ii',  file: 'audio/you-are-the-lord.mp3' },

  // C5 - Vol. III
  { id: 'bethel',              title: 'Bethel',              volume: 'vol-iii', file: 'audio/bethel.mp3' },

  // D5 - Vol. IV
  { id: 'clouds-of-glory',     title: 'Clouds of Glory',     volume: 'vol-iv',  file: 'audio/clouds-of-glory.mp3' },

  // ---- Songs 45-47: a fifth song on Vol. V - VII ----

  // E5 - Vol. V
  { id: 'living-in-your-will', title: 'Living in Your Will', volume: 'vol-v',   file: 'audio/living-in-your-will.mp3' },

  // G5 - Vol. VI
  { id: 'love-abiding',        title: 'Love Abiding',        volume: 'vol-vi',  file: 'audio/love-abiding.mp3' },

  // H5 - Vol. VII
  { id: 'this-is-the-message', title: 'This Is the Message', volume: 'vol-vii', file: 'audio/this-is-the-message.mp3' },

  // ---- Song 48: a fifth song on Vol. VIII ----

  // J5 - Vol. VIII
  { id: 'by-our-lord-jesus',   title: 'By Our Lord Jesus',   volume: 'vol-viii', file: 'audio/by-our-lord-jesus.mp3' },

  // ---- Song 49: a fifth song on Vol. IX ----

  // K5 - Vol. IX
  { id: 'my-redeemer-liveth',  title: 'My Redeemer Liveth',  volume: 'vol-ix',   file: 'audio/my-redeemer-liveth.mp3' },

  // ---- Song 50: a fifth song on Vol. X (every album now has 5) ----

  // L5 - Vol. X
  { id: 'holy-spirit-helper',  title: 'Holy Spirit Helper',  volume: 'vol-x',    file: 'audio/holy-spirit-helper.mp3' },

  // ---- Songs 51-53: a sixth song on Vol. I - III ----

  // A6 - Vol. I
  { id: 'reigning-in-life',    title: 'Reigning in Life',    volume: 'vol-i',    file: 'audio/reigning-in-life.mp3' },

  // B6 - Vol. II
  { id: 'he-lives',            title: 'He Lives',            volume: 'vol-ii',   file: 'audio/he-lives.mp3' },

  // C6 - Vol. III
  { id: 'fire-of-love',        title: 'Fire of Love',        volume: 'vol-iii',  file: 'audio/fire-of-love.mp3' },

  // ---- Song 54: a sixth song on Vol. IV ----

  // D6 - Vol. IV
  { id: 'communion-chorus',    title: 'Communion Chorus',    volume: 'vol-iv',   file: 'audio/communion-chorus.mp3' },

  // ---- Songs 55-56: a sixth song on Vol. V and VI ----

  // E6 - Vol. V
  { id: 'bought-with-a-price',           title: 'Bought with a Price',           volume: 'vol-v',  file: 'audio/bought-with-a-price.mp3' },

  // G6 - Vol. VI
  { id: 'fight-the-good-fight-of-faith', title: 'Fight the Good Fight of Faith', volume: 'vol-vi', file: 'audio/fight-the-good-fight-of-faith.mp3' },

  // ---- Songs 57-61: a sixth song on Vol. VII - X, then a seventh on Vol. I ----

  // H6 - Vol. VII
  { id: 'see-your-goodness',    title: 'See Your Goodness',    volume: 'vol-vii',  file: 'audio/see-your-goodness.mp3' },

  // J6 - Vol. VIII
  { id: 'fully-convinced',      title: 'Fully Convinced',      volume: 'vol-viii', file: 'audio/fully-convinced.mp3' },

  // K6 - Vol. IX
  { id: 'press-on',             title: 'Press On',             volume: 'vol-ix',   file: 'audio/press-on.mp3' },

  // L6 - Vol. X
  { id: 'love-is-believing',    title: 'Love Is Believing',    volume: 'vol-x',    file: 'audio/love-is-believing.mp3' },

  // A7 - Vol. I
  { id: 'celebrate-the-saviour', title: 'Celebrate the Saviour', volume: 'vol-i',  file: 'audio/celebrate-the-saviour.mp3' },

  // ---- Songs 62-66: a seventh song on Vol. II - VI ----

  // B7 - Vol. II
  { id: 'let-obedience',        title: 'Let Obedience',        volume: 'vol-ii',  file: 'audio/let-obedience.mp3' },

  // C7 - Vol. III
  { id: 'peace-be-to-this-house', title: 'Peace Be to This House', volume: 'vol-iii', file: 'audio/peace-be-to-this-house.mp3' },

  // D7 - Vol. IV
  { id: 'confidence',           title: 'Confidence',           volume: 'vol-iv',  file: 'audio/confidence.mp3' },

  // E7 - Vol. V
  { id: 'because-of-the-cross-of-christ', title: 'Because of the Cross of Christ', volume: 'vol-v', file: 'audio/because-of-the-cross-of-christ.mp3' },

  // G7 - Vol. VI
  { id: 'know-the-lord',        title: 'Know the Lord',        volume: 'vol-vi',  file: 'audio/know-the-lord.mp3' },
];
