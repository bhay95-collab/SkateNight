# Skate by Faith

**Not by Sight - An 80s Rollerskate Night**

An 80s arcade jukebox, presented by RFAI, that plays your playlist at the
roller-skate night.
It is a website that runs on **one laptop** plugged into the projector. No
accounts, no server, no database. You add songs by editing one file and uploading
MP3s.

Live address once switched on (see step 6). The repository is still named
`SkateNight`, so the address keeps that name; to change it, GitHub -> Settings ->
Repository name (the address changes with it):
`https://bhay95-collab.github.io/SkateNight/`

![The jukebox playing](docs/screenshots/04-now-playing.jpg)

*(Screenshots in `docs/screenshots/` use stand-in covers and test tones, not your
real artwork or songs: power-on, INSERT COIN, choosing a song, now playing.)*

---

## What is in this folder

| Name | What it is | Do you touch it? |
|---|---|---|
| `tracks.js` | The list of albums (volumes) and songs | **Yes - the only file you edit** |
| `audio/` | The MP3 files | **Yes - upload songs here** |
| `covers/` | The album cover pictures | **Yes - upload covers here** |
| `rfai-logo.png` | The RFAI headphone-robot logo | Only to swap it |
| everything else | The machine itself | No |

Each of `audio/` and `covers/` has its own short README.

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

Do the same inside the **`covers`** folder for the cover pictures (square `.jpg`
files, named like `vol-v.jpg`).

> Limits: GitHub's website refuses a single file over **25 MB** (Suno MP3s are
> well under that). The whole site should stay under about **1 GB** - roughly 150
> songs. 80 songs is comfortable.

## 4. Add each song to `tracks.js` - worked example

You uploaded `rolling-thunder.mp3` and it belongs on **Vol. V**.

1. On GitHub, click **`tracks.js`**.
2. Click the **pencil icon** (Edit this file) at the top right of the file.
3. Find the `tracks = [` list near the bottom. Add a new line **inside the
   square brackets** (anywhere between `[` and `]`), copying the pattern exactly:

```js
  { id: 'rolling-thunder', title: 'Rolling Thunder', volume: 'vol-v', file: 'audio/rolling-thunder.mp3' },
```

4. Click the green **Commit changes...** button (top right), then **Commit
   changes** again in the box that appears.
5. Wait about a minute, then reload the jukebox.

What each part means:

| Part | Meaning |
|---|---|
| `id: 'rolling-thunder'` | A nickname for the song. **Lower case, no spaces, different for every song.** |
| `title: 'Rolling Thunder'` | What appears on screen. Capitals and spaces are fine here. |
| `volume: 'vol-v'` | Which album it belongs to. Must match an `id` in the `volumes` list above. |
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
in the order it appears within its volume. So the first Vol. V song is `B1` if
Vol. V is the second volume. Moving a song up or down the list changes its code.
(Letters F, N, I and O are skipped: F and N are keyboard shortcuts, and I and O
look like 1 and 0 from across the rink.)

**Adding a whole new album (volume):** add a line inside the `volumes = [` list:

```js
  { id: 'vol-x', title: 'Vol. X', cover: 'covers/vol-x.jpg', accent: 'mauve' },
```

`accent` is the paint colour of that album's sleeve and code chips. Choose one:
`teal`, `mauve`, `gold`, `paper`, `sepia`.

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
5. Under **Branch**, choose the branch that has the jukebox in it, leave the
   folder as **`/ (root)`**, and click **Save**. (This build was made on a branch
   called `claude/festive-lovelace-mr1yju`; if you have merged it into `main`,
   choose `main` instead.)
6. Wait 1-2 minutes and refresh the Pages screen. A box at the top says **"Your
   site is live at ..."** - that is the address for the venue laptop.

> The repository must be **public** for free GitHub Pages.

## 7. Night-of checklist

**The day before, at home or the venue, on the venue laptop:**

- [ ] Open the site in **Google Chrome** (best supported).
- [ ] Press **INSERT COIN** (click it, or press any key).
- [ ] Press **LOAD THE CRATES** (bottom right). The meter fills and the little
      light at the top right changes to **OFFLINE READY**. This saves every
      song on the laptop so the night runs even if the venue wifi dies. Press it
      again after you add songs.
- [ ] Press **START** and listen to a few songs.

**On the night:**

- [ ] Plug the laptop into **power** (important - it will run for hours).
- [ ] **Plug in the projector** and set the laptop to **Duplicate / Mirror**
      displays (Windows: press the Windows key + **P**, choose *Duplicate*. Mac:
      System Settings -> Displays -> *Mirror*).
- [ ] Open the jukebox site in Chrome.
- [ ] Press **F** for **fullscreen** (press **Esc** to leave).
- [ ] Press **INSERT COIN**, then **START**.
- [ ] **Test volume:** move the **MUSIC** slider (or tap the up/down arrow keys)
      while someone stands at the back of the rink. The laptop's own volume
      should be about three-quarters up; use the jukebox slider to fine-tune.
- [ ] If the picture looks too busy for the room, press **LIGHTS: FULL** to
      switch to **LIGHTS: CALM** (no flashing or moving effects).
- [ ] Turn off notifications on the laptop (so a pop-up never covers the screen).

**If the page is closed or reloaded by accident:** open the site again and press
INSERT COIN -> START. The queue starts empty (the house rotation fills the gap).

## How it behaves

- **START** begins with the house rotation (random songs, never repeating any of
  the last 5). It does **not** start automatically, so you can test volume first.
- **Pick a song** by clicking its strip in **The Rack**, or by typing its code on
  the on-screen keypad (letter, number, then **SELECT**), or on your keyboard
  (for example `B`, `1`, `Enter`). The chosen song joins **UP NEXT**.
- UP NEXT plays **first in, first out**. Use the arrows to move a song up and the
  cross to remove one.
- When UP NEXT is empty, the **house rotation** picks the next song itself, so the
  rink is never silent.
- **Credits** are for show. The machine never refuses a song; with no credits it
  says **FREE PLAY**.
- After **60 seconds** with nobody touching anything, the machine runs a light
  show. Touch any key to stop it.
- Switching songs fades out and in. You hear no hard cuts.

### Keyboard

| Key | Does |
|---|---|
| **Space** | Play / pause (and START the first time) |
| **N** | Next song |
| **F** | Fullscreen on / off |
| **Up / Down arrows** | Music volume up / down |
| **A-Z, 0-9, Enter** | Type a selection code, e.g. `B` `1` `Enter` |
| **Backspace / Esc** | Delete / clear the typed code |
| **?** | Show the key list again (it hides after a few seconds) |

Laptop **media keys** (play / pause / next) work too.

### LIGHTS: FULL / CALM

The machine is full of moving lights. **LIGHTS: CALM** turns every decorative
animation off and shows the finished picture instead (the clock, the progress bar
and the queue still update). It starts in whichever mode the laptop's own "reduce
motion" setting asks for, and remembers your choice.

The effects are built to stay safe for people who are sensitive to flashing:
nothing flashes faster than three times a second, and music-driven lights swell
smoothly instead of strobing. Details are in `DESIGN.md`.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| No sound at all | Click anywhere on the page (browsers need one click first). Check the MUSIC slider, the laptop volume, and that the tab is not muted. |
| A song says **OUT OF ORDER** | Its file is missing or the name in `tracks.js` does not match. Check the exact spelling and capitals. |
| Red **CHECK TRACKS.JS** button | Click it for a plain-English list. Usually a missing comma or quote. |
| **START-UP PROBLEM - PRESS F5** | Reload the page. If it keeps happening, tell whoever maintains the site. |
| New song does not appear | GitHub can take a minute or two to publish. Reload, then press LOAD THE CRATES again. |
| Light says **NOT OFFLINE YET** | Press **LOAD THE CRATES** while you have internet. |
| Light says **SAVED - NEEDS HTTPS** | The page was opened from a plain `http://` address. Use the GitHub Pages `https://` address. |
| Screen is too bright / busy | Press **LIGHTS: CALM**. |

---

## For whoever maintains the code

- Static site: plain HTML + CSS + ES modules, no build step.
- Tests: `npm test` (uses Node's built-in test runner, nothing to install).
  Covers the queue, selection-code generation, tracks.js validation, the house
  rotation, the copy pools, the audio maths and the lights switch.
- To look at it locally: serve the folder with any static server that supports
  byte ranges (for example `npx http-server`) and open it in Chrome. Opening
  `index.html` straight from disk will not work (browsers block ES modules there).
- `DESIGN.md` records the material system, palette, motion rules, safety rules
  and the reasoning behind the reliability design (including why songs are played
  from Blob URLs instead of through the service worker).
- The page exposes `window.__skateNight` (state + player) for tests and for
  debugging in the console. The night does not depend on it.

### What was tested, and what was not

Tested (headless Chromium via Playwright, 1280x720 plus 1920x1080, 1440x900,
1366x768 and 1024x768; served like GitHub Pages including from a `/SkateNight/`
sub-path):

- `npm test` - 56 tests, all passing (queue, codes, `tracks.js` validation,
  house rotation, copy pools, audio maths, lights switch, CSS safety rules).
- Boot, INSERT COIN, selection by keyboard / keypad / strip, UP NEXT, house
  rotation, record changer frames, now-playing readouts, idle attract mode.
- Natural song change: about 40 ms between songs. Skip: about 1.2-1.4 s (the
  record changer working). Pause / resume, volume keys.
- CALM lights from the OS setting and from the switch (no animations running
  at all; choice remembered across reload).
- A missing MP3 (OUT OF ORDER, skipped, house rotation avoids it) and a broken
  `tracks.js` (red CHECK TRACKS.JS button, site still alive).
- LOAD THE CRATES, then the network switched off: the page reloads and songs
  play from the saved copy.
- Soak: 14 minutes of continuous play including about 70 skips and queue
  changes: JavaScript memory flat at 2-3 MB, page elements and running
  animations constant, console clean.
- No horizontal scrolling at any of the sizes above.

**Not tested (needs a real laptop and projector):** real speakers (sound was
checked through the machine's own level meters, not by ear), the laptop's
media keys, real fullscreen and screen-sleep prevention (the headless browser
refuses the wake lock), a three-hour run, Safari and Firefox, and performance on
a genuinely slow laptop (the headless browser draws in software, so it is a
pessimistic stand-in). Please do a 10-minute run-through on the venue laptop a
day before. If it ever stutters, **LIGHTS: CALM** removes nearly all the work.

