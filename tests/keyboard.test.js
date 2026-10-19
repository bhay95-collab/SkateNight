import test from 'node:test';
import assert from 'node:assert/strict';
import { installCabinetKeyboard } from '../keyboard.js';

function element({ selectors = [], parent = null, editable = false, attributes = {} } = {}) {
  return {
    isContentEditable: editable,
    getAttribute: (name) => attributes[name] ?? null,
    closest(query) {
      if (query.split(',').some((selector) => selectors.includes(selector.trim()))) return this;
      return parent?.closest(query) || null;
    },
  };
}

function cabinet({ started = true, code = '', modal = false } = {}) {
  const handlers = new Map();
  const calls = [];
  const state = { started, code, modal };
  const eventTarget = {
    addEventListener(type, handler) { handlers.set(type, handler); },
    removeEventListener(type, handler) {
      assert.equal(handlers.get(type), handler);
      handlers.delete(type);
    },
  };
  const action = (name) => (...args) => calls.push([name, ...args]);
  const dispose = installCabinetKeyboard({
    codeLetters: new Set(['A', 'B', 'C']),
    isStarted: () => state.started,
    getCode: () => state.code,
    onKey: action('key'),
    onTogglePlay: action('play'),
    onBack: action('back'),
    onSkip: action('skip'),
    onShuffle: action('shuffle'),
    onFullscreen: action('fullscreen'),
    onVolume: action('volume'),
    onHelp: action('help'),
    onAlbumStep: action('album'),
    eventTarget,
    documentRoot: {
      querySelector(selector) {
        assert.equal(selector, 'dialog[open]');
        return state.modal ? {} : null;
      },
    },
  });
  return {
    calls, state, handlers, dispose,
    press(key, { target = element(), ...options } = {}) {
      const event = {
        key, target, defaultPrevented: false, repeat: false,
        preventDefault() { this.defaultPrevented = true; },
        ...options,
      };
      handlers.get('keydown')?.(event);
      return event;
    },
  };
}

test('background Space toggles once while held, without installing a keyup handler', () => {
  const scene = cabinet();
  assert.equal(scene.press(' ').defaultPrevented, true);
  assert.equal(scene.press(' ', { repeat: true }).defaultPrevented, true);
  assert.deepEqual(scene.calls, [['play']]);
  assert.deepEqual([...scene.handlers.keys()], ['keydown']);
  scene.dispose();
  assert.equal(scene.handlers.size, 0);
  scene.press(' ');
  assert.deepEqual(scene.calls, [['play']]);
});

test('native activation wins for focused buttons, links and disclosures with a pending code', () => {
  const scene = cabinet({ code: 'B2' });
  for (const selector of ['button', 'a[href]', 'summary', '[role="button"]', '[role="link"]']) {
    const target = element({ parent: element({ selectors: [selector] }) });
    for (const key of [' ', 'Spacebar', 'Enter']) {
      assert.equal(scene.press(key, { target }).defaultPrevented, false, `${selector}: ${key}`);
    }
  }
  assert.deepEqual(scene.calls, []);
});

test('editing controls and slider keys retain native keyboard behavior', () => {
  const scene = cabinet({ code: 'B2' });
  const targets = ['input', 'textarea', 'select', '[role="textbox"]', '[role="combobox"]', '[role="slider"]']
    .map((selector) => element({ selectors: [selector] }));
  targets.push(element({ editable: true }));
  targets.push(element({ parent: element({ selectors: ['[contenteditable]'], attributes: { contenteditable: '' } }) }));
  for (const target of targets) {
    for (const key of [' ', 'Enter', 'Backspace', 'Escape', 'a', '2', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '?']) {
      assert.equal(scene.press(key, { target }).defaultPrevented, false);
    }
  }
  assert.deepEqual(scene.calls, []);
});

test('list and queue arrows scroll without changing transport or volume', () => {
  const scene = cabinet();
  for (const selector of ['[tabindex]', '[role="list"]', '[role="listbox"]', '#queue-screen', '#queue-list', 'button']) {
    const target = element({ parent: element({ selectors: [selector] }) });
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      assert.equal(scene.press(key, { target }).defaultPrevented, false, `${selector}: ${key}`);
    }
  }
  assert.deepEqual(scene.calls, []);
});

test('left and right arrows inside the actual rack browse albums instead of skipping music', () => {
  const scene = cabinet();
  const rack = element({ selectors: ['.rack-panel'] });
  const target = element({ selectors: ['button'], parent: rack });
  assert.equal(scene.press('ArrowLeft', { target }).defaultPrevented, true);
  assert.equal(scene.press('ArrowRight', { target }).defaultPrevented, true);
  scene.press('ArrowRight', { target, repeat: true });
  assert.deepEqual(scene.calls, [['album', -1], ['album', 1]]);
});

test('background arrows retain transport and volume shortcuts', () => {
  const scene = cabinet();
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    assert.equal(scene.press(key).defaultPrevented, true);
  }
  scene.press('ArrowRight', { repeat: true });
  scene.press('ArrowUp', { repeat: true });
  assert.deepEqual(scene.calls, [['back'], ['skip'], ['volume', 5], ['volume', -5], ['volume', 5]]);
});

test('open modal dialogs leave shortcuts and Escape with the browser', () => {
  const scene = cabinet({ code: 'B2', modal: true });
  for (const key of [' ', 'Enter', 'Escape', 'Backspace', 'ArrowRight', 'ArrowUp', 'a', '1', 'n', '?']) {
    assert.equal(scene.press(key).defaultPrevented, false);
  }
  assert.deepEqual(scene.calls, []);
  scene.state.modal = false;
  scene.press(' ');
  assert.deepEqual(scene.calls, [['play']]);
});

test('startup, modifiers and already-handled events cannot trigger global shortcuts', () => {
  const scene = cabinet({ started: false, code: 'B2' });
  scene.press(' ');
  scene.state.started = true;
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }]) {
    for (const key of [' ', 'Enter', 'Backspace', 'a', 'n', '?']) scene.press(key, options);
  }
  assert.deepEqual(scene.calls, []);
});

test('code entry, submission and clearing share the selector actions', () => {
  const scene = cabinet();
  assert.equal(scene.press('Enter').defaultPrevented, false);
  assert.equal(scene.press('Escape').defaultPrevented, false);
  scene.press('a');
  scene.press('2');
  scene.press('z');
  scene.press('2', { repeat: true });
  scene.state.code = 'A2';
  scene.press('Enter');
  scene.press('Backspace');
  scene.press('Escape');
  assert.deepEqual(scene.calls, [['key', 'A'], ['key', '2'], ['key', 'SELECT'], ['key', 'BACK'], ['key', 'CLEAR']]);
});

test('documented letter commands and help work once per key press', () => {
  const scene = cabinet();
  for (const key of ['n', 'P', 's', 'F', '?']) {
    assert.equal(scene.press(key).defaultPrevented, true);
    scene.press(key, { repeat: true });
  }
  assert.deepEqual(scene.calls, [['skip'], ['back'], ['shuffle'], ['fullscreen'], ['help']]);
});
