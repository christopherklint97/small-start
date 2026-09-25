export const DEFAULT_DURATIONS = Object.freeze({ focus: 25, short: 5, long: 15 });
export const BOUNDS = Object.freeze({ focus: [2, 90], short: [1, 30], long: [5, 60] });
export const MODES = ['focus', 'short', 'long'];

export function cleanDurations(value) {
  return Object.fromEntries(MODES.map(mode => {
    const n = Number(value?.[mode]);
    const [min, max] = BOUNDS[mode];
    return [mode, Number.isInteger(n) && n >= min && n <= max ? n : DEFAULT_DURATIONS[mode]];
  }));
}
export function initialState(durations = DEFAULT_DURATIONS) {
  const d = cleanDurations(durations);
  return { mode: 'focus', status: 'idle', remaining: d.focus * 60, roundDuration: d.focus * 60, endsAt: null,
    durations: d, completed: [], task: '', captures: [], sound: true };
}
export function remainingSeconds(state, now = Date.now()) {
  return state.status === 'running' ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : state.remaining;
}
export function bonusSeconds(state, now = Date.now()) {
  if (state.status === 'overtime') return Math.max(0, Math.floor((now - state.endsAt) / 1000));
  return state.status === 'paused-overtime' ? state.bonusSeconds : 0;
}
export function nextMode(state) {
  if (state.mode !== 'focus') return 'focus';
  return ['complete', 'overtime', 'paused-overtime'].includes(state.status) && state.completed.length > 0 && state.completed.length % 4 === 0 ? 'long' : 'short';
}
export function settle(state, now = Date.now()) {
  if (state.status !== 'running' || remainingSeconds(state, now) > 0) return { state, completed: false };
  const completed = state.mode === 'focus';
  return { state: { ...state, status: completed ? 'overtime' : 'complete', remaining: 0, endsAt: completed ? state.endsAt : null,
    completed: completed ? [...state.completed, state.endsAt] : state.completed }, completed };
}
export function start(state, now = Date.now()) {
  if (state.status === 'paused-overtime') return { ...state, status: 'overtime', endsAt: now - state.bonusSeconds * 1000 };
  if (state.status !== 'idle' && state.status !== 'paused') return state;
  if (state.remaining <= 0) return state;
  return { ...state, status: 'running', endsAt: now + state.remaining * 1000 };
}
export function pause(state, now = Date.now()) {
  if (state.status === 'overtime') return { ...state, status: 'paused-overtime', bonusSeconds: bonusSeconds(state, now), endsAt: null };
  if (state.status !== 'running') return state;
  const { state: settled } = settle(state, now);
  if (settled.status === 'complete') return settled;
  if (settled.status === 'overtime') return pause(settled, now);
  return { ...state, status: 'paused', remaining: remainingSeconds(state, now), endsAt: null };
}
export function reset(state, now = Date.now()) {
  state = settle(state, now).state;
  return { ...state, status: 'idle', endsAt: null, bonusSeconds: 0, remaining: state.durations[state.mode] * 60, roundDuration: state.durations[state.mode] * 60 };
}
export function switchMode(state, mode, now = Date.now()) {
  if (!MODES.includes(mode)) return state;
  state = settle(state, now).state;
  return { ...state, mode, status: 'idle', endsAt: null, bonusSeconds: 0, remaining: state.durations[mode] * 60, roundDuration: state.durations[mode] * 60 };
}
export function advance(state) {
  if (!['complete', 'overtime', 'paused-overtime'].includes(state.status)) return state;
  return switchMode(state, nextMode(state));
}
export function changeDurations(state, value) {
  const durations = cleanDurations(value);
  return { ...state, durations, ...(state.status === 'idle' ? { remaining: durations[state.mode] * 60, roundDuration: durations[state.mode] * 60 } : {}) };
}
export function restore(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (!value || !MODES.includes(value.mode) || !['idle', 'running', 'paused', 'complete', 'overtime', 'paused-overtime'].includes(value.status)) throw Error('invalid');
    const durations = cleanDurations(value.durations);
    const remaining = Number(value.remaining);
    const state = { mode: value.mode, status: value.status,
      remaining: Number.isFinite(remaining) && remaining >= 0 && remaining <= 5400 ? Math.ceil(remaining) : durations[value.mode] * 60,
      roundDuration: Number.isFinite(value.roundDuration) && value.roundDuration >= 60 && value.roundDuration <= 5400 ? value.roundDuration : durations[value.mode] * 60,
      endsAt: value.status === 'running' && Number.isFinite(value.endsAt) ? value.endsAt : null,
      bonusSeconds: Number.isSafeInteger(value.bonusSeconds) && value.bonusSeconds >= 0 ? value.bonusSeconds : 0,
      durations,
      completed: Array.isArray(value.completed) ? value.completed.filter(n => Number.isFinite(n) && n <= now && n > 0).slice(-500) : [],
      task: typeof value.task === 'string' ? value.task.slice(0, 140) : '',
      captures: Array.isArray(value.captures) ? value.captures.filter(x => x && typeof x.text === 'string').slice(-30).map(x => ({ id: String(x.id), text: x.text.slice(0, 140) })) : [],
      sound: value.sound !== false };
    if (state.status === 'running' && !state.endsAt) return { state: { ...state, status: 'paused' }, completed: false };
    if (state.status === 'overtime') {
      if (state.mode !== 'focus' || !Number.isFinite(value.endsAt) || value.endsAt > now) throw Error('invalid overtime');
      state.endsAt = value.endsAt;
    }
    if (state.status === 'paused-overtime' && state.mode !== 'focus') throw Error('invalid overtime');
    return settle(state, now);
  } catch { return { state: initialState(), completed: false }; }
}
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
