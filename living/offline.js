// Runtime files of the photorealistic jukebox, relative to this module. sw.js precaches the same list (a test keeps
// them equal); live.js also fetches them once online and confirms each is saved before OFFLINE READY.
export const OFFLINE_FILES=Object.freeze([
  '../index.html','live.js','live.css','math.js','drive.js','film-check.js','offline.js',
  ...['hero.webp','changer.webp','catalog.json','load-mask.png','eject-mask.png','load-tracking.json','eject-tracking.json','arm.webp','arm.json','drive.json'].map(x=>`assets/${x}`),
  ...Array.from({length:9},(_,n)=>`assets/load-${n}.webp`),...Array.from({length:6},(_,n)=>`assets/eject-${n}.webp`),
  ...['play','play-over','load','load-over','eject','eject-over','gear-26','gear-32','gear-28','gear-40'].map(x=>`assets/drive-${x}.webp`),
]);
