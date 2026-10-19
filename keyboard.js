/* Cabinet shortcuts defer to the control the operator is actually using.
   Native activation, editing, scrolling and modal focus stay with the browser. */
export function installCabinetKeyboard({
  codeLetters,
  isStarted,
  getCode,
  onKey,
  onTogglePlay,
  onBack,
  onSkip,
  onShuffle,
  onFullscreen,
  onVolume,
  onHelp,
  onAlbumStep,
  eventTarget = window,
  documentRoot = document,
}) {
  const letters = new Set(codeLetters);
  const closest = (target, selector) => target?.closest?.(selector);
  const nativeControls = 'button, a[href], summary, [role="button"], [role="link"]';
  const editableControls = 'input, textarea, select, [role="textbox"], [role="combobox"], [role="slider"]';
  const arrowControls = `${nativeControls}, [tabindex], [role="list"], [role="listbox"], [role="tree"], [role="grid"], [role="menu"], #queue-screen, #queue-list`;

  function keydown(event) {
    if (!isStarted() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (documentRoot.querySelector('dialog[open]')) return;
    const target = event.target;
    // isContentEditable includes descendants of a contenteditable container.
    if (target?.isContentEditable || closest(target, editableControls)) return;
    const editableParent = closest(target, '[contenteditable]');
    if (editableParent && editableParent.getAttribute('contenteditable') !== 'false') return;

    const key = event.key;
    const space = key === ' ' || key === 'Spacebar';
    if ((space || key === 'Enter') && closest(target, nativeControls)) return;

    const consume = (action, allowRepeat = false) => {
      event.preventDefault();
      if (!event.repeat || allowRepeat) action();
    };
    if (space) { consume(onTogglePlay); return; }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const direction = key === 'ArrowLeft' ? -1 : 1;
      if (closest(target, '.rack-panel')) consume(() => onAlbumStep(direction));
      else if (!closest(target, arrowControls)) consume(direction < 0 ? onBack : onSkip);
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (!closest(target, arrowControls)) consume(() => onVolume(key === 'ArrowUp' ? 5 : -5), true);
      return;
    }
    if (key === 'Enter') {
      if (getCode()) consume(() => onKey('SELECT'));
      return;
    }
    if (key === 'Backspace') { consume(() => onKey('BACK'), true); return; }
    if (key === 'Escape') {
      if (getCode()) consume(() => onKey('CLEAR'));
      return;
    }
    if (key === '?') { consume(onHelp); return; }

    const upper = key.length === 1 ? key.toUpperCase() : '';
    const commands = { N: onSkip, P: onBack, S: onShuffle, F: onFullscreen };
    if (Object.hasOwn(commands, upper)) { consume(commands[upper]); return; }
    if (letters.has(upper) || /^\d$/.test(upper)) consume(() => onKey(upper));
  }

  eventTarget.addEventListener('keydown', keydown);
  // No keyup cancellation: focused buttons need their native Space click.
  return () => eventTarget.removeEventListener('keydown', keydown);
}
