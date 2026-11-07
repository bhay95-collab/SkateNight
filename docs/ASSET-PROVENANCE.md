# Asset provenance

Where the production assets come from, how to rebuild or recover them, and
their checksums at the final production release (7 November 2026). Source
copies are in `/Users/benjaminhay/SkateNight-Archive/` (see its `README.md` and
`CHECKSUMS.sha256`).

## Film

*The Song Inside*: a 35-second, 1920x1080, native-30 Blender cinematic (1,050
frames) with Sound Design V5-B4 (industrial score, machinery, groove atmosphere,
stylus scratch, musical breakthroughs of *We Have Come* and *According to His
Power*, and the travelling laugh). It is effects-only: *Praise Lifted On High* is
played by the jukebox.

- **Pipeline:** `cinematic/` (Blender scripts, cues: `cinematic/extended/cues.json`).
- **V5 audio:** branch `codex/cinematic-sound-v5` (`b68773b`).
- **Promotion:** `scripts/promote-awakening.mjs`.
- **Archive:**
  - final production render: `cinematic/final-render-1080-v2/`
  - scenes: `blender-scenes/`
  - audio masters and stems: `audio/masters-and-stems/`
  - every published film with its manifest: `cinematic/films/`

| File | Bytes | SHA-256 |
|---|---|---|
| `films/song-inside-35s-v3.mp4` | 26,666,888 | `2a2fca5bededb3751e51c5779b1e24a893e7bcba060bcccd42633bbd2d627b61` |
| `films/song-inside-35s-v2.mp4` | 26,671,302 | `402b2ca892d26dd56a9762429e2fbc2a4461d020065fc57ea299adbd12983cc9` |
| `films/manifest.json` | 3,703 | `3ea87f86e7278770181f5307da3c29eb773a6c4a720f3a767fc4cdf26e656b18` |

## Songs and artwork

- **Songs:** the 70 songs in `audio/` (10 RFAI albums, listed in `tracks.js`) are the project's own RFAI recordings, exported from Suno (README steps 1-3).
- **Artwork:** album covers (`covers/`) and `rfai-logo.png` are RFAI artwork.

A full copy with matching checksums is in the archive under `library/`.

## Sound effects

The production files are listed below.

- **Original cabinet effects:** the `sfx/*.wav` key, coin, buzz and page sounds are synthesised by `scripts/generate-sfx.py`.
- **Record surface:** `sfx/vinyl-surface.wav` is the approved Sound Design V4 loop.
- **Recorded record changer, needle drop and ambience:** `sfx/needle-drop.wav` and `sfx/jukebox/*` are trimmed, optimised excerpts of a purchased source pack, mostly Motion Array recordings, built by `scripts/build-jukebox-sfx.mjs`. The originals are in the archive under `audio/jukebox-sfx/source-pack/`; details are in `sfx/README.md`.

**Licensing (outstanding):** confirm that the Motion Array and other source licences cover the event and these excerpts being publicly downloadable from GitHub Pages.

| File | Bytes | SHA-256 |
|---|---|---|
| `sfx/buzz.wav` | 13,274 | `ee9a52bfea6ec44be29e5d32cc94e658ff14f27162887d660c7cdb5ff972b513` |
| `sfx/coin.wav` | 25,622 | `0e4cb0540d576be306728c75e555936a4b6f2f0c4ebde1df0914bf9d10162f67` |
| `sfx/confirm.wav` | 10,848 | `15a276ffd597d620c48ffd77c26f9b00e931509b8dad02b1a3a77f4b2fd67785` |
| `sfx/jukebox/bed-electric.flac` | 333,641 | `c1fb6c76c5b694049bdc7da2379a892c3c0e44138f8966870d0eaba5b43426c6` |
| `sfx/jukebox/bed-machine.flac` | 100,283 | `c999428b257afac2d53409dd49686bdd14e5921f3117027016e42d3b6b6ea08e` |
| `sfx/jukebox/mechanics.mp3` | 361,788 | `ca452c72acdbaf777c645ed22d42675361eb204194384fd5827d290a30b940b1` |
| `sfx/key.wav` | 3,792 | `869c6594ab3194d45938480cd41b7638c8d2869636d0e5678c7304936c87cd1c` |
| `sfx/needle-drop.wav` | 28,302 | `72ec7b8b97d1bf67f326043b12fc4cafd3fa87ec8857966c11c969ea67b1c7e9` |
| `sfx/page.wav` | 14,156 | `229e11d4c24440d50d2ca331a4d004477ec95f2ca0c6a5884ec14634ffe6d357` |
| `sfx/thud.wav` | 6,660 | `90abdb04ac3a26c2325ebad260e0eb1957465326c19a669dc8a5682fb65b7e1b` |
| `sfx/vinyl-surface.wav` | 2,592,044 | `e18e5d9e316574e656a041b6634e9e5523845535dd7b89a7f778ced0fac52c47` |
| `sfx/whirr.wav` | 49,436 | `2e7362ac7449277843523282fd18549d41e3db210970fd34b775f226ad6bb10f` |

## Photorealistic jukebox visuals

**Source scene.** Codex's approved Living Jukebox scene: the cabinet, the record changer, and the engineering revision with the power, index and platter-drive assemblies. It is archived as `blender-scenes/79d825a194b4-engineering-study.blend` (SHA-256 `79d825a194b4709b6d3ff3c1cefe255a25c388f60448e19386ad395450fa31a5`).

**Where the scripts live:**

- **Study and pose solver:** `codex/living-jukebox-v2`.
- **Integration and change-sheet packing:** `codex/living-jukebox-integration`.
- **Drive renderer and packer:** `claude/living-jukebox-drive`, under `prototypes/living-jukebox/integration/drive/`.

**How the drive layers were made.** The gear frames, plates and masks were rendered with Cycles (Metal) from that scene, with its lights and materials unchanged.

**The files below are the complete production set.**

| File | Bytes | SHA-256 |
|---|---|---|
| `living/assets/arm.json` | 475 | `934a152b40dae5143246f68ca017e9626ceb505ee255118239ac6fc3cbdfb5d4` |
| `living/assets/arm.webp` | 371,270 | `1578fa260bd6c07da46e3ffb2e1e2486b2dceeec29ec451114b4011733b74192` |
| `living/assets/catalog.json` | 16,744 | `7b9741067e67c91cfa33ed844d096ffe48d80d37ce942c55095aaabb24018725` |
| `living/assets/changer.webp` | 316,804 | `8ecb584bcff6577825cbda8737402697c56985694eaf186dc4193183473d454b` |
| `living/assets/drive-eject-over.webp` | 30,008 | `21ebd532d46bd00e64183bee4bc0fe464f6cabc09991b11b58e176aea7553a9a` |
| `living/assets/drive-eject.webp` | 525,102 | `acffc3023af859a80305697cc17e58ad7978eeb8404b49f55d26a89f02762fe3` |
| `living/assets/drive-gear-26.webp` | 127,802 | `4a851e62ec0c0c73772bf8eaec5321cd114e21c30f165bb7cf975b936c7a63ba` |
| `living/assets/drive-gear-28.webp` | 184,062 | `a8c877d968f79790774bd2232029f5f8656030c7cae592e769717ac7481b07b8` |
| `living/assets/drive-gear-32.webp` | 177,156 | `3d5fd66b12608b302a3cdfc7ee1e7e2e4164ed1b52d219e2c035d8effce2d5be` |
| `living/assets/drive-gear-40.webp` | 113,972 | `f3fb9fa64b03e4848489b88c76bc5f60351d901b6385fc93ace1f659df707d29` |
| `living/assets/drive-load-over.webp` | 44,944 | `be8dcf60a1f9cb9f407793872f32924784d1b3511245f59cd91f8bb666a9f478` |
| `living/assets/drive-load.webp` | 777,032 | `3b0b3542c51ede140acc79a5cd4b22266e2a4567877b809b70678cf2c5dda973` |
| `living/assets/drive-play-over.webp` | 846 | `0f361f37b8258636d6bd055d413c7fad3504367aea60ac2839545bb6b935369f` |
| `living/assets/drive-play.webp` | 11,700 | `99c47f0e8c7a90359d258afe165430bb38ba09729ae1aa7ff0f9069bbe7295c9` |
| `living/assets/drive.json` | 4,098 | `8e8799af8096d81872b210d74dbd80a5cb80883381f3505c2584253d866b36e3` |
| `living/assets/eject-0.webp` | 458,268 | `7145b2b35bd6518b857efc0fcfdb8e54400da0f819900ff53242ac1fd839bc43` |
| `living/assets/eject-1.webp` | 459,786 | `9edb4d65646f3ca540fec612a0d026e4c00c3cfed426cf2b6a081cce4be72d29` |
| `living/assets/eject-2.webp` | 456,670 | `91266b7ad0e9c94320bd9399fa204a9b1fcdaf240fc1d40236fe35fd29be52dd` |
| `living/assets/eject-3.webp` | 469,712 | `6afcf1f2162a148e212e4c001c44a411a4b9d90fcc51a0a2e679367da63c9b4d` |
| `living/assets/eject-4.webp` | 471,574 | `1431e517c04ca355707fe4b12b8a9727c39cec1955cb2edb20868e0dacb35086` |
| `living/assets/eject-5.webp` | 468,512 | `5d625260e710cf8bf0f679c1cdac28c67694a240befa5be5869b80e4913d0ed9` |
| `living/assets/eject-mask.png` | 74,921 | `11bdb3c9f9c2bddf27dc0cdd41de8a785900d5a6cd8b464ba6484b33721ff034` |
| `living/assets/eject-tracking.json` | 12,865 | `ff1365d37c3b70056928c96a68e264ddea85138fd59a449f3ff5c6822009ae63` |
| `living/assets/hero.webp` | 320,070 | `91909e729f7317ef0b3e93155288769e725813a99755fb40d58bab7a12b40e1e` |
| `living/assets/load-0.webp` | 478,042 | `d5b4867160f4fe8c66ceefe5beaecf9e04f9b0a69a4e196ccd3f26f6ab69809d` |
| `living/assets/load-1.webp` | 470,408 | `8ca38b748600cb7e523d986d11b6dd9eed55f1bc670f8d2e2c1e826b93c065d7` |
| `living/assets/load-2.webp` | 472,112 | `08e0076d5a271770d0d23d6ec697753847315555ffc82894d4eb37c6b1fc33c8` |
| `living/assets/load-3.webp` | 471,596 | `57050534a264c4d28957b1418313df78c007586da5487333eb490746b277f0e0` |
| `living/assets/load-4.webp` | 470,404 | `4094f718dcbe814080fbec6daa6998fd28cafecf29dae752460dd8a5e04b213f` |
| `living/assets/load-5.webp` | 457,358 | `1bc64885bd736a91a2127770f4bf08ee6266b2b50150fc54911b035912bec726` |
| `living/assets/load-6.webp` | 479,874 | `3bf9fa0a91036b8eb3e59db4205dbf26e8d1ef522a670cb4152788b2808f0ba3` |
| `living/assets/load-7.webp` | 460,444 | `4dc036fcf1d62dd64ad3b57937acde94d0f906f7a518aeff35deb64552c56c6a` |
| `living/assets/load-8.webp` | 463,392 | `e43623f62749c6c513ad34a303a53c67ea6f13620e5e97663ac9dff36cb807ae` |
| `living/assets/load-mask.png` | 112,732 | `aa4f16cc9e27d816fae4a0190bd8be2ac9b2d2debc55429d900d2c9f6b578180` |
| `living/assets/load-tracking.json` | 19,128 | `48a822d088958ae05fd701c07229235e7aadb12875c8fa7cbe4e567fd842b1ff` |

## Fonts and icons

- **Fonts** (`fonts/`, WOFF2 subsets): Bungee, Barlow (400, 500, 700) and JetBrains Mono, all under the SIL Open Font License 1.1.
- **App icons** (`icons/`): the project's own icons, made from the RFAI robot mark.
