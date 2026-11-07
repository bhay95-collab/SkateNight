# Show operations

How to prepare, run and recover the night on the event laptop. The default page
is the photorealistic jukebox; `classic-jukebox.html` is the same application in
its classic presentation, kept as the emergency fallback.

| | Address |
|---|---|
| Show (default) | `https://bhay95-collab.github.io/SkateNight/` |
| Classic fallback | `https://bhay95-collab.github.io/SkateNight/classic-jukebox.html` |

Both pages share the songs, film, settings and offline storage: preparing one
prepares the other.

## Night-of checklist

**The day before, at home or the venue, on the venue laptop:**

> Use **Google Chrome** (or the installed app), never VS Code's built-in browser: it cannot play the
> film's audio and silently falls back to the old live-cut awakening.

- [ ] Open the site in **Google Chrome** on the laptop:
      `https://bhay95-collab.github.io/SkateNight/` (the https address - the
      install below needs it).
- [ ] **Install it as an app (once per laptop):** Chrome's menu (the three
      dots, top right) -> **Cast, save and share** -> **Install page as app**
      (older Chrome: **Install Skate by Faith** or *Save and share* ->
      *Install*, or the small install icon at the right of the address bar).
      You get a **Skate by Faith** icon on the desktop / in the dock or Start
      menu, and the jukebox opens in its own window with no tabs or address bar.
- [ ] Open it from the new **Skate by Faith** icon. The dark cabinet appears;
      in the installed app Chrome normally allows the low hum to start by
      itself (no click needed). If the room stays silent, that is fine - the
      first click wakes it as usual.
- [ ] Click the dark cabinet (or press any key) - there is no button on purpose.
- [ ] Open **TOOLS** (bottom right), then press **LOAD THE CRATES**. The thin strip along the bottom of that button fills and the little
      light at the top right changes to **OFFLINE READY**. This saves every
      song on the laptop so the night runs even if the venue wifi dies.
      OFFLINE READY means everything: every song, the verified film
      (Tools -> Prepare for Show shows `VERIFIED - READY OFFLINE ... SHA 2A2FCA5B`)
      and the photorealistic machine's visuals (it reads **SAVING JUKEBOX VISUALS**
      until those are confirmed). Press it
      again after you add songs. Then **test it offline**: turn the laptop's
      wifi off, close the app, open it from its icon again, and play a song.
- [ ] Press **START** and listen to a few songs.

**On the night:**

- [ ] Plug the laptop into **power** (important - it will run for hours).
- [ ] **Plug in the projector** and set the displays to **Duplicate / Mirror**
      (Windows: Windows key + **P** -> *Duplicate*. Mac: System Settings ->
      Displays -> *Mirror*). The one app window is both your controls and
      the room's picture.
- [ ] Turn off notifications on the laptop (so a pop-up never covers the screen).
- [ ] Open **Skate by Faith** from its icon. If the window still has a title
      bar, press **F** (or TOOLS -> **FULLSCREEN**) **before the audience
      arrives** - press **Esc** to leave. (On a dedicated event laptop a
      kiosk shortcut can launch it borderless: see *Fullscreen* below.)
- [ ] Click the dark cabinet (or press any key) to put the coin in. The
      machine wakes, goes dark, and the night's first song (**Praise Lifted On
      High**) starts in the dark; the jukebox appears on its second bar. Nobody
      presses START. Make sure that song is saved (**OFFLINE READY**) first.
- [ ] **Test volume beforehand**, not on the night (the music starts by itself): move the **MUSIC** slider (or tap the up/down arrow keys
      with the cabinet background focused)
      while someone stands at the back of the rink. The laptop's own volume
      should be about three-quarters up; use the jukebox slider to fine-tune.

**If the app is closed or reloaded by accident:** open it again from its icon
and click the dark cabinet (or press any key). The machine wakes again and the
next song starts by itself (the opening song isn't repeated in the same
window). The queue starts empty (the house rotation fills the gap).

**To hold the music** (for example to test the volume first, or for a rehearsal):
untick TOOLS -> **The Awakening starts the music**. The next time the page is
opened, the Awakening hands over to the old power-on screen and the jukebox
waits for **START**, exactly as before. Tick it again for the night.

**Picture and sound at the venue:** the jukebox appears when the song itself
reaches its second bar, allowing for the delay Chrome reports. Projectors and
sound desks add their own delays. If the picture lands visibly before or after
the beat in the room, the fix is one number (`REVEAL_OFFSET_MS` in app.js).

**Fullscreen:** the app asks Chrome for fullscreen, but desktop Chrome usually
opens installed apps in an ordinary app window with a title bar. Use **F** or
TOOLS -> FULLSCREEN before the audience arrives (it is not switched on by
itself mid-film, so the coin sequence never jumps). For a truly borderless
start on a dedicated machine, make a shortcut that runs Chrome with
`--kiosk https://bhay95-collab.github.io/SkateNight/` (close every other
Chrome window first; Alt+F4 / Cmd+Q to leave).


## Updating an installed laptop

Open the app online. It fetches the new version in the background and keeps the
saved songs and film. Reload once, then check that the light reads **OFFLINE
READY** again before going offline. Do not update during the show.

## Switching to the classic fallback

If the photorealistic machine misbehaves on the event hardware (judder, a blank
cabinet, a projector problem), open `classic-jukebox.html` (type it after the
address, or keep it as a second bookmark/shortcut). It works offline, plays the
same film and music and keeps the queue rules. No Git or internet is needed.

## Recovering from a browser failure

1. Reopen the app from its icon (or Chrome). Click the dark cabinet: the next
   song starts by itself; the opener is not repeated in the same window.
2. If the page will not start, press **F5**. If it still fails, open the classic
   fallback.
3. If the film shows the old animation, the film is not saved or this is not
   Chrome: Tools -> **Prepare for Show** (CHECK / DOWNLOAD) when online.

## Event-hardware rehearsal (before promotion is relied on)

On the event MacBook Pro, projector and PA:

- Projector resolution (1280x720 and 1920x1080 are tested), refresh rate and
  mirroring. The gears should turn smoothly, without judder.
- Song timing on that machine (commands in `docs/RELEASE.md`).
- PA latency (the stylus touchdown against the first beat), the film-to-song
  loudness step, and the changer, needle and ambience levels.
- Several changes: picks, two skips (1.8x) and a song ending naturally.
- A full offline rehearsal, including switching to the classic fallback.

## Diagnostics

- `?diagnostics` labels which film is playing (approved or live cut).
- `?drive=0` shows the photorealistic machine with its static drive.
- `?live` forces the live cut. `?hum` arms the waiting hum (below).

## The machine's hum while it waits

In the **installed app** the hum starts by itself when the app opens, if
Chrome allows it (it normally does for installed apps). To keep the room
silent, press **Alt+Shift+D** (Option+Shift+D on a Mac) while the hum plays:
it stops, and stays off on later launches until you press it again.

In an ordinary browser tab it is optional:

Before the night, open the site with **?hum** on the end of the address
(for example `.../SkateNight/?hum`). The first tap, click or key press then
switches the hum on instead of putting the coin in: nothing appears on
screen, and within a few seconds a low electrical drone rises out of the
speakers and breathes with the little robot on the tube. The next press
wakes the machine as usual. This works on a phone or tablet too. Once
armed, the device remembers: next time, if the browser has not yet allowed
sound, the first press switches the hum on again rather than putting the
coin in. On a laptop you can instead press **Alt+Shift+D**
(on a Mac: Option+Shift+D) at any time before the coin; press it again to
switch it off. The laptop remembers, so after a reload (or next time, if
the browser allows this site sound) it hums by itself. Without it the
waiting screen is silent, as browsers require. Either way, when someone
touches the machine the hum stops dead - it holds its breath - and the
film's own power-up takes over. It follows the EFFECTS volume.


## Keyboard

| Key | Does |
|---|---|
| **Space** | Play / pause |
| **N** or **Right arrow** | Next song |
| **P** or **Left arrow** | Back: restart this song, or press again for the previous one |
| **S** | Shuffle on / off |
| **F** | Fullscreen on / off |
| **Up / Down arrows** | Music volume up / down |
| **A-Z, 0-9, Enter** | Type a selection code, e.g. `B` `1` `Enter` |
| **Backspace / Esc** | Delete / clear the typed code |
| **?** | Show the key list again (it hides after a few seconds) |

These shortcuts respect the focused control. Enter/Space activate a focused
button or TOOLS disclosure, even with a song code pending. Up/Down scroll the
focused album list or queue. Left/Right inside the album rack browse albums;
transport arrows work on the cabinet background. Sliders, editing controls and
browser shortcuts retain their native keys. The diagnostic dialog contains
focus, blocks cabinet shortcuts, and returns focus to CHECK TRACKS.JS on closing.

Laptop **media keys** (play / pause / next / previous) work too.


## Lights

The machine is full of moving lights, always at full. The whole screen gently
swells with cyan/magenta edge light in time with the bass beat, and settles
when the music stops.

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
| Light says **NOT OFFLINE YET** | Press the status, then **LOAD THE CRATES** while you have internet. |
| Light says **SAVED - NEEDS HTTPS** | The page was opened from a plain `http://` address. Use the GitHub Pages `https://` address. |
| No hum when the app opens | Chrome is holding sound back. It is fine: the first click wakes the machine with sound. To hear the hum before the night, see *The machine's hum while it waits*. |
| No **Install** option in Chrome's menu | Use the `https://` GitHub Pages address (not a saved file), and wait for the page to finish loading once. |

---
| Light says **SAVING JUKEBOX VISUALS** | The photorealistic visuals are still being confirmed. Stay online a few seconds; if it persists, reload online. |
| The cabinet looks like the classic machine on the default page | Its visuals failed to load, so it fell back to the classic look; the music is unaffected. Reload online when possible. |
| Film shows the old animation | Not Chrome, or no verified film: Tools -> Prepare for Show while online. |
