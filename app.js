import { initialState, restore, start, pause, reset, switchMode, advance, settle, changeDurations, remainingSeconds, formatTime, nextMode } from './timer.js';

const STORAGE_KEY = 'small-start:v1';
const $ = id => document.getElementById(id);
const readState = () => { try { return restore(localStorage.getItem(STORAGE_KEY)); } catch { return { state: initialState(), completed: false }; } };
let { state, completed: restoredCompletion } = readState();
let audioContext;
let wakeLock;
let urgeEndsAt = null;
const labels = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const ringLength = 2 * Math.PI * 123;

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode/storage disabled: timer still works */ } }
function update(next) { state = next; save(); render(); syncWakeLock(); }
function announce(message) { $('timer-message').textContent = message; }
function beep() {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    for (const [i, frequency] of [660, 880].entries()) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const time = audioContext.currentTime + i * .2;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime(.09, time + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .18);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(time); oscillator.stop(time + .2);
    }
  } catch { /* audio is best effort */ }
}
async function notifyCompletion(mode) {
  beep();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker?.ready;
      const title = mode === 'focus' ? 'Focus round complete' : 'Break complete';
      const options = { body: mode === 'focus' ? 'Take a real break. You showed up.' : 'Ready for one small next step?', icon: './icons/icon-192.png' };
      if (registration?.showNotification) await registration.showNotification(title, options);
      else new Notification(title, options);
    } catch { /* optional */ }
  }
}
async function syncWakeLock() {
  if (state.status !== 'running') {
    if (wakeLock) { try { await wakeLock.release(); } catch {} wakeLock = null; }
    return;
  }
  if (!wakeLock && document.visibilityState === 'visible' && navigator.wakeLock?.request) {
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch {}
  }
}
function tick() {
  const before = state.mode;
  const outcome = settle(state);
  if (outcome.state !== state) { state = outcome.state; save(); notifyCompletion(before); syncWakeLock(); announce(before === 'focus' ? 'Focus round complete. Take a break.' : 'Break complete. Your next step is ready.'); }
  renderTimer(); renderUrge();
}
function renderTimer() {
  const seconds = remainingSeconds(state);
  const duration = state.roundDuration;
  $('time-display').textContent = formatTime(seconds);
  $('ring-progress').style.strokeDashoffset = String(ringLength * (1 - Math.min(1, seconds / duration)));
  $('timer-overline').textContent = state.mode === 'focus' ? 'TIME TO FOCUS' : 'TIME TO RESET';
  $('timer-caption').textContent = state.status === 'complete' ? 'You showed up.' : state.mode === 'focus' ? 'Just this one step.' : 'Step away from the feed.';
  $('round-label').textContent = `ROUND ${state.completed.length % 4 + (state.mode === 'focus' ? 1 : 0) || 4} OF 4`;
  const action = state.status === 'running' ? 'Pause' : state.status === 'paused' ? 'Keep going' : state.status === 'complete' ? `Start ${nextMode(state) === 'focus' ? 'next focus' : nextMode(state) === 'long' ? 'long break' : 'short break'}` : state.mode === 'focus' ? 'Start focusing' : 'Start break';
  $('main-action-label').textContent = action;
  $('reset-button').disabled = false;
  $('skip-button').disabled = state.status === 'complete';
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.classList.toggle('active', button.dataset.mode === state.mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    button.disabled = state.status === 'running' || state.status === 'paused';
  }
  document.title = state.status === 'running' ? `${formatTime(seconds)} · ${labels[state.mode]} — Small Start` : 'Small Start — focus without the pressure';
}
function renderCaptures() {
  const list = $('capture-list'); list.replaceChildren();
  for (const item of state.captures) {
    const li = document.createElement('li');
    const text = document.createElement('span'); text.textContent = item.text;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${item.text}`);
    remove.addEventListener('click', () => update({ ...state, captures: state.captures.filter(x => x.id !== item.id) }));
    li.append(text, remove); list.append(li);
  }
}
function render() {
  renderTimer(); renderCaptures();
  if ($('task-input').value !== state.task) $('task-input').value = state.task;
  const today = new Date().toDateString();
  const count = state.completed.filter(t => new Date(t).toDateString() === today).length;
  $('today-count').textContent = `${count} focus round${count === 1 ? '' : 's'} today`;
}
function renderUrge() {
  if (urgeEndsAt === null) return;
  const seconds = Math.max(0, Math.ceil((urgeEndsAt - Date.now()) / 1000));
  $('urge-time').textContent = formatTime(seconds);
  if (seconds === 0) { urgeEndsAt = null; $('urge-panel').querySelector('p').textContent = 'The pause is over. Choose deliberately: return to your step, rest, or do something else.'; $('urge-time').textContent = '00:00'; }
}
$('main-action').addEventListener('click', () => {
  if (state.status === 'running') { update(pause(state)); announce('Paused. Pick up when you’re ready.'); }
  else if (state.status === 'complete') { update(start(advance(state))); announce(state.mode === 'focus' ? 'One small step is enough.' : 'Take a real break.'); }
  else { update(start(state)); announce(state.mode === 'focus' ? 'One small step is enough.' : 'Take a real break.');
    if (state.sound) { try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); } catch {} }
  }
});
$('reset-button').addEventListener('click', () => { update(reset(state)); announce('Reset. Start again whenever you like.'); });
$('skip-button').addEventListener('click', () => { update(switchMode(state, nextMode(state))); announce('Skipped. No penalty.'); });
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { update(switchMode(state, button.dataset.mode)); announce(`${labels[state.mode]} selected.`); });
$('task-input').addEventListener('input', event => { state = { ...state, task: event.target.value }; save(); });
$('tiny-step').addEventListener('click', () => {
  update(changeDurations(state, { ...state.durations, focus: 2 }));
  if (state.status === 'idle' && state.mode !== 'focus') update(switchMode(state, 'focus'));
  $('task-input').focus(); announce(state.status === 'running' || state.status === 'paused' ? 'Next focus round set to 2 minutes.' : 'Two minutes is enough to start.');
});
$('capture-form').addEventListener('submit', event => {
  event.preventDefault(); const input = $('capture-input'); const text = input.value.trim(); if (!text) return;
  update({ ...state, captures: [...state.captures, { id: `${Date.now()}-${Math.random()}`, text }].slice(-30) }); input.value = '';
});
$('urge-button').addEventListener('click', () => { $('urge-panel').hidden = false; $('urge-panel').querySelector('p').textContent = 'What am I reaching for—rest, relief, or stimulation? No judgment. Take a breath and decide after the timer.'; urgeEndsAt = Date.now() + 60_000; renderUrge(); });
$('urge-cancel').addEventListener('click', () => { urgeEndsAt = null; $('urge-panel').hidden = true; });
$('settings-open').addEventListener('click', () => {
  for (const mode of ['focus', 'short', 'long']) $(`duration-${mode}`).value = state.durations[mode];
  $('sound-toggle').checked = state.sound; $('settings-dialog').showModal();
});
$('settings-close').addEventListener('click', () => $('settings-dialog').close());
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const dialog = $('settings-dialog'); if (!event.target.reportValidity()) return;
  const values = Object.fromEntries(['focus', 'short', 'long'].map(m => [m, Number($(`duration-${m}`).value)]));
  update({ ...changeDurations(state, values), sound: $('sound-toggle').checked }); dialog.close(); announce('Settings saved.');
});
$('notify-button').addEventListener('click', async () => {
  if (!('Notification' in window)) { $('notify-button').textContent = 'Notifications unavailable here'; return; }
  const permission = await Notification.requestPermission();
  $('notify-button').textContent = permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled';
});
document.addEventListener('visibilitychange', () => { tick(); syncWakeLock(); });
window.addEventListener('pageshow', tick);
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { state = readState().state; render(); syncWakeLock(); } });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
if (restoredCompletion) save();
render(); setInterval(tick, 250); syncWakeLock();
