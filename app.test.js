import test from 'node:test';
import assert from 'node:assert/strict';

function setup(saved) {
  const elements = new Map();
  const node = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', value: '', style: {}, dataset: {}, disabled: false, checked: false,
      listeners: {}, classList: { toggle() {} }, setAttribute() {}, replaceChildren() {}, append() {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      querySelector() { return node('urge-text'); },
    });
    return elements.get(id);
  };
  const documentListeners = {};
  globalThis.document = {
    title: '', visibilityState: 'visible', getElementById: node,
    querySelectorAll: () => [], createElement: () => node(`created-${elements.size}`),
    addEventListener(type, fn) { documentListeners[type] = fn; },
  };
  const windowListeners = {};
  globalThis.window = { addEventListener(type, fn) { windowListeners[type] = fn; } };
  Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
  globalThis.localStorage = {
    value: saved,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
  };
  let tick;
  globalThis.setInterval = fn => { tick = fn; return 1; };
  return { node, documentListeners, windowListeners, tick: () => tick() };
}

test('completed round at zero can be reset in the UI', async () => {
  const now = Date.now();
  const app = setup(JSON.stringify({ mode: 'focus', status: 'running', remaining: 120,
    roundDuration: 120, endsAt: now - 1000, durations: { focus: 2, short: 1, long: 5 },
    completed: [], task: '', captures: [], sound: false }));
  await import(`./app.js?test=reset-${now}`);
  assert.equal(app.node('time-display').textContent, '00:00');
  assert.equal(app.node('reset-button').disabled, false, 'reset should be usable after completion');
  app.node('reset-button').listeners.click();
  assert.equal(app.node('time-display').textContent, '02:00');
  assert.equal(JSON.parse(localStorage.value).status, 'idle');
});

test('completion uses the service worker notification API on mobile', async () => {
  const now = Date.now();
  const app = setup(JSON.stringify({ mode: 'focus', status: 'running', remaining: 120,
    roundDuration: 120, endsAt: now + 1000, durations: { focus: 2, short: 1, long: 5 },
    completed: [], task: '', captures: [], sound: false }));
  const notifications = [];
  globalThis.Notification = { permission: 'granted' };
  window.Notification = globalThis.Notification;
  navigator.serviceWorker = { ready: Promise.resolve({ showNotification: async (...args) => notifications.push(args) }), register: async () => {} };
  await import(`./app.js?test=notification-${now}`);
  // Settling through the active page's tick path.
  const realNow = Date.now;
  Date.now = () => now + 2000;
  try { app.tick(); await new Promise(resolve => setImmediate(resolve)); }
  finally { Date.now = realNow; }
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0][0], 'Focus round complete');
});
