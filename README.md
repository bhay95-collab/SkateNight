# Skate by Faith

**Not by Sight - An 80s Rollerskate Night**

An 80s arcade jukebox, presented by RFAI, that plays the playlist at the
roller-skate night. It is a website (an installable, offline PWA) that runs on
**one laptop** plugged into the projector. No accounts, no server, no database.

- Show: `https://bhay95-collab.github.io/SkateNight/` - a dormant arcade cabinet;
  insert the coin and the 35-second film **The Song Inside** (Sound Design V5-B4)
  carries straight into the photorealistic jukebox, already playing, its record
  driven by turning gears and changed by a mechanical record changer.
- Fallback: `https://bhay95-collab.github.io/SkateNight/classic-jukebox.html` -
  the same application in its classic presentation.

Use **Google Chrome** (or the installed app), never VS Code's built-in browser.

| Document | For |
|---|---|
| [docs/SHOW-OPERATIONS.md](docs/SHOW-OPERATIONS.md) | Preparing and running the night, offline, fallback, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the application, film, audio, visuals and offline storage work |
| [docs/RELEASE.md](docs/RELEASE.md) | Validation, deployment and rollback |
| [docs/ASSET-PROVENANCE.md](docs/ASSET-PROVENANCE.md) | Where the film, sound, artwork and renders come from; checksums; licensing |
| `DESIGN.md` | Material system, palette, motion and safety rules |

---

## What is in this folder

| Name | What it is | Do you touch it? |
|---|---|---|
| `tracks.js` | The list of albums (volumes) and songs | **Yes - the only file you edit** |
| `audio/` | The MP3 files | **Yes - upload songs here** |
| `covers/` | The album cover pictures | **Yes - upload covers here** |
| `sfx/` | Mechanical effects, ambience and vinyl recordings; optional custom replacements | Only to swap a sound |
| `rfai-logo.png` | The RFAI headphone-robot logo | Only to swap it |
| `index.html`, `living/` | The photorealistic jukebox (default page) and its rendered visuals | No |
| `classic-jukebox.html` | The classic presentation (fallback) | No |
| `films/` | The approved film and its manifest | Only through `npm run cinematic:promote` |
| `cinematic/`, `scripts/`, `tests/` | Film pipeline sources, tools and tests | Maintainers |
| everything else | The machine itself | No |

`audio/`, `covers/`, `sfx/` and `films/` each have a short README.

---

## 1. Get the MP3s out of Suno

Suno moves its buttons around from time to time, so if this does not match what
you see, look for a **Download** option on the song. At the time of writing:

1. Go to suno.com and sign in.
2. Open your **Library** and find the song.
3. Click the **three dots** (⋯) next to the song.
4. Click **Download**, then **MP3 Audio**.
5. The file lands in your computer's **Downloads** folder.

Do this for every song you want in the night. The files are usually 3-8 MB each.

## 2. Rename the files

The jukebox finds each song by its file name, so give every file a simple name:

- all **lower case**
- **no spaces** - use dashes instead
- no brackets or symbols
- ends in **`.mp3`**

| Suno gave you | Rename it to |
|---|---|
| `Rolling Thunder (1).mp3` | `rolling-thunder.mp3` |
| `Chrome Hearts v2.mp3` | `chrome-hearts.mp3` |

(On a Mac or Windows PC: click the file once, press **F2** on Windows or
**Return** on Mac, type the new name, press Enter.)

## 3. Upload the songs and covers to GitHub

1. Open your repository: `https://github.com/bhay95-collab/SkateNight`
2. Click the **`audio`** folder.
3. Click the **Add file** button (top right) -> **Upload files**.
4. Drag your renamed MP3s into the box (up to 100 at once).
5. Scroll down and click the green **Commit changes** button.

The covers for Vol. I to Vol. X are already in the **`covers`** folder.
For a new volume, do the same inside `covers` with a square `.jpg` named like
`vol-xi.jpg`.

> Limits: GitHub's website refuses a single file over **25 MB** (Suno MP3s are
> well under that). The whole site should stay under about **1 GB** - roughly 150
> songs. 80 songs is comfortable.

## 4. Add each song to `tracks.js` - worked example

You uploaded `rolling-thunder.mp3` and it belongs on **Vol. II**.

1. On GitHub, click **`tracks.js`**.
2. Click the **pencil icon** (Edit this file) at the top right of the file.
3. Find the `tracks = [` list near the bottom. Add a new line **inside the
   square brackets** (anywhere between `[` and `]`), copying the pattern exactly:

```js
  { id: 'rolling-thunder', title: 'Rolling Thunder', volume: 'vol-ii', file: 'audio/rolling-thunder.mp3' },
```

4. Click the green **Commit changes...** button (top right), then **Commit
   changes** again in the box that appears.
5. Wait about a minute, then reload the jukebox.

What each part means:

| Part | Meaning |
|---|---|
| `id: 'rolling-thunder'` | A nickname for the song. **Lower case, no spaces, different for every song.** |
| `title: 'Rolling Thunder'` | What appears on screen. Capitals and spaces are fine here. |
| `volume: 'vol-ii'` | Which album it belongs to. Must match an `id` in the `volumes` list above. |
| `file: 'audio/rolling-thunder.mp3'` | The file in the `audio` folder. **Must match the real file name exactly.** |

**The three rules:**

1. Keep the shape exactly: curly brackets `{ }`, **quote marks** around words,
   and a **comma at the end** of every line. A missing comma or quote is the
   number one thing that breaks the file.
2. Lines starting with `//` are notes for people. The computer ignores them.
3. **Never type a song length or a selection code.** The jukebox reads the
   length from the MP3 and makes the codes (A1, A2, B1...) from the *order* of
   the list.

**How the codes work:** each volume gets a letter in the order they are listed -
the first volume is **A**, the second **B**, and so on. Each song gets a number
in the order it appears within its volume. So the first Vol. II song is `B1`, because
Vol. II is the second volume in the list.

| Volume | I | II | III | IV | V | VI | VII | VIII | IX | X |
|---|---|---|---|---|---|---|---|---|---|---|
| Letter | A | B | C | D | E | **G** | **H** | **J** | **K** | **L** |

Notice the skipped letters: F, N and P are keyboard shortcuts (fullscreen,
next, previous), S is kept free, and I and O are never used (they look like 1 and 0), so
Vol. VI is **G**, not F. This table is also written at the top of
`tracks.js`. Moving a song up or down the list changes its code.

**Where to put new songs:** spread them evenly, fewest songs first (right
now every album, Vol. I - X, has 7 songs, 70 in all; the next song goes on Vol. I). Add each new song at the **end** of the
`tracks = [` list, so no existing code changes. Each album has one complete
track list beneath a flexible cover: all current songs fit without turning pages.
The panel is tuned for seven songs per album: the list hugs its rows and every
spare bit of height goes to the album cover and the big album arrow keys. The
cover grows when the screen has spare room and shrinks before tracks do.
If a future album outgrows the window, scroll its list; typing a code brings
that song into view automatically.

**Adding a whole new album (volume):** add a line inside the `volumes = [` list:

```js
  { id: 'vol-xi', title: 'Vol. XI', cover: 'covers/vol-xi.jpg', accent: 'teal' },
```

`accent` is the colour of that album's little code chips and record label. Choose
one: `teal`, `mauve`, `gold`, `rust`, `wine`, `paper`, `sepia`.

Where you put the line matters: it sets the album's letter. Add new volumes at
the **end** of the list (Vol. XI becomes **M**). Putting one in the middle shifts
the letters, and so every song code, of the volumes after it.

**If you break something:** a red button appears in the top right of the jukebox
saying **CHECK TRACKS.JS**. Click it - it lists, in plain English, what is wrong
and which entry was skipped. The jukebox keeps running and only skips the broken
entry. If the whole file is broken it tells you that too.

**If a file is missing or misnamed:** that song shows **OUT OF ORDER** in the
rack, is skipped, and the rest carry on. (Your browser's developer console will
show grey "404" lines for missing files. That is normal and harmless.)

## 5. Add the RFAI logo

1. Make the logo a **512 x 512 pixel PNG with a transparent background**, named
   exactly **`rfai-logo.png`**.
2. On GitHub, open the repository's main page.
3. **Add file -> Upload files**, drag your `rfai-logo.png` in. Because the name
   is the same as the existing stand-in, it replaces it.
4. Click **Commit changes**.

It appears on the power-on screen, the INSERT COIN screen, the top-left of the
machine, and as the browser-tab icon. The headphone-robot logo is already in
place; follow these steps only if you want to swap it for a new one.

## 6. Switch on GitHub Pages (put it on the internet)

1. Open `https://github.com/bhay95-collab/SkateNight`.
2. Click **Settings** (the tab with a cog, along the top).
3. In the left menu click **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Under **Branch**, choose **`main`**, leave the folder as **`/ (root)`**, and
   click **Save**.
6. Wait 1-2 minutes and refresh the Pages screen. A box at the top says **"Your
   site is live at ..."** - that is the address for the venue laptop.

> The repository must be **public** for free GitHub Pages.

## Running the night

Follow [docs/SHOW-OPERATIONS.md](docs/SHOW-OPERATIONS.md): install the app in
Chrome, press **LOAD THE CRATES** and wait for **OFFLINE READY** (every song,
the verified film and the jukebox visuals), test offline, then insert the coin.
If the photorealistic machine misbehaves, open `classic-jukebox.html`.

## Local development and maintenance

- Static site: plain HTML + CSS + ES modules, no build step.
- Tests: `npm test` (uses Node's built-in test runner, nothing to install).
  Covers the queue, selection-code generation, tracks.js validation, the house
  rotation, the copy pools, the audio maths, keyboard routing, UI state and responsive
  artwork.
- To look at it locally: serve the folder with any static server that supports
  byte ranges (for example `npx http-server`) and open it in Chrome. Opening
  `index.html` straight from disk will not work (browsers block ES modules there).
- Optional browser regression checks use Playwright and a Chromium
  installation; these are developer tools, not application dependencies. With
  the local server running, use
  `python3 scripts/check-ui.py --base-url http://127.0.0.1:8080 --chromium /usr/bin/chromium`.
- Optional motion checks: `npm run test:motion` (with the local server running).
  `node --test` cannot see an animation, so every unit test passes just as
  happily with the rack flip broken. These assert the things that must not
  drift - the album cover and the title strips turning as one page, a turn
  being interruptible, CALM stopping motion at once - rather than the exact
  timings, which are meant to be tuned. They need Node Playwright
  (`npm i -D playwright && npx playwright install chromium`) and exit 2, not 1,
  when it is missing.
- `DESIGN.md` records the material system, palette, motion rules, safety rules
  and the reasoning behind the reliability design (including why songs are played
  from Blob URLs instead of through the service worker).
- The page exposes `window.__skateNight` (state + player) for tests and for
  debugging in the console. The night does not depend on it.
- On-device benchmark: launch the ready PWA with `?bench` to measure the film, or
  `?bench&cut=plunge&live=1` to measure the live Plunge source (video-frame callbacks,
  dropped frames, p95 frame interval, long tasks, GPU time). Compare on the same display,
  Chrome profile and power mode.
- Release gates, deployment and rollback: `docs/RELEASE.md`.
