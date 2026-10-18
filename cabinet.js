/* The native disclosure keeps occasional cabinet controls within reach.
   Let its controls keep their browser keyboard behaviour while the machine's
   shortcuts continue to work everywhere else. */
const tools = document.getElementById('cabinet-tools');
const summary = tools?.querySelector('summary');

const isActivationKey = (key) => [' ', 'Spacebar', 'Enter'].includes(key);
const isDrawerControl = (target) => target instanceof Element && target.closest('summary, button');
const arrivalIsActive = () => tools?.closest('[inert]') || document.body.classList.contains('on-attract');

tools?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && tools.open) {
    tools.open = false;
    summary?.focus({ preventScroll: true });
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  // Do not preventDefault: Space and Enter must still activate the focused
  // summary/button, without also toggling music or submitting a song code.
  if (isDrawerControl(event.target) && isActivationKey(event.key)) event.stopPropagation();
});

tools?.addEventListener('keyup', (event) => {
  // The app also captures Space on keyup, which otherwise cancels the native
  // click generated for a focused button.
  if (isDrawerControl(event.target) && isActivationKey(event.key)) event.stopPropagation();
});

document.addEventListener('pointerdown', (event) => {
  if (tools?.open && !tools.contains(event.target)) tools.open = false;
});

document.getElementById('btn-keys')?.addEventListener('click', () => {
  if (!tools || arrivalIsActive()) return;
  tools.open = false;
  summary?.focus({ preventScroll: true });
  // Reuse the application's existing legend timer and input handling.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
});
