/* Native disclosure keeps the operator's service controls off the fascia.
   Preserve its keyboard behaviour alongside the jukebox's global shortcuts. */
const settings = document.getElementById('cabinet-settings');
const summary = settings?.querySelector('summary');

settings?.addEventListener('keydown', (event) => {
  if (event.target.closest('summary, button') && [' ', 'Enter'].includes(event.key)) event.stopPropagation();
  if (event.key === 'Escape' && settings.open) {
    settings.open = false;
    summary.focus();
    event.stopPropagation();
  }
});
settings?.addEventListener('keyup', (event) => {
  if (event.target.closest('summary, button') && event.key === ' ') event.stopPropagation();
});
document.addEventListener('pointerdown', (event) => {
  if (settings?.open && !settings.contains(event.target)) settings.open = false;
});
