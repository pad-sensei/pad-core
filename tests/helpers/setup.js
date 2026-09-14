// Minimal browser globals mock for Node.js environment
const mockElement = () => ({
  className: '',
  textContent: '',
  innerHTML: '',
  classList: { toggle: () => {}, add: () => {}, remove: () => {} },
  style: {},
  appendChild: () => {},
  addEventListener: () => {},
  setAttribute: () => {},
  onclick: null,
  disabled: false,
});

globalThis.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElementNS: () => mockElement(),
  createElement: () => mockElement(),
};

// Load pad-core modules → inject all exports as globals
const data = require('../../data.js');
Object.assign(globalThis, data);

const theory = require('../../theory.js');
Object.assign(globalThis, theory);

const chordResolver = require('../../chord-resolver.js');
Object.assign(globalThis, chordResolver);

const render = require('../../render.js');
Object.assign(globalThis, render);

const circle = require('../../circle.js');
Object.assign(globalThis, circle);

const builderUI = require('../../builder-ui.js');
Object.assign(globalThis, builderUI);

const incremental = require('../../incremental.js');
Object.assign(globalThis, incremental);
