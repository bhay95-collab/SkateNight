// Runtime files of the living jukebox, relative to this module. live.js fetches them once online; the unchanged
// production worker saves each response, so the page and its visuals work offline afterwards.
export const OFFLINE_FILES=Object.freeze([
  '../living-jukebox.html','live.js','live.css','math.js','drive.js','film-check.js','offline.js',
  ...['hero.webp','changer.webp','catalog.json','load-mask.png','eject-mask.png','load-tracking.json','eject-tracking.json','arm.webp','arm.json','drive.json'].map(x=>`assets/${x}`),
  ...Array.from({length:9},(_,n)=>`assets/load-${n}.webp`),...Array.from({length:6},(_,n)=>`assets/eject-${n}.webp`),
  ...['play','play-over','load','load-over','eject','eject-over','gear-26','gear-32','gear-28','gear-40'].map(x=>`assets/drive-${x}.webp`),
]);
