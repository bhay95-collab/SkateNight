# audio/ - the songs

Put your MP3 files here. One file per song.

**Names matter.** The name in `tracks.js` must match the file name exactly,
including capital letters. The safest habit: all lower case, no spaces, use
dashes, end in `.mp3`.

    rolling-thunder.mp3        good
    Rolling Thunder (v2).mp3   will cause trouble - spaces, brackets, capitals

After adding a file, add a line for it in `tracks.js` (see the main README for
a worked example). A file that is here but not listed in `tracks.js` is simply
ignored. A song listed in `tracks.js` whose file is missing shows
**OUT OF ORDER** and is skipped.

Size tips: a Suno MP3 is usually 3-8 MB, which is fine. GitHub's website refuses
single uploads over 25 MB.
