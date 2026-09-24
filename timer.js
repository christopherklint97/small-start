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
export function nextMode(state) {
  if (state.mode !== 'focus') return 'focus';
  return state.status === 'complete' && state.completed.length > 0 && state.completed.length % 4 === 0 ? 'long' : 'short';
}
export function settle(state, now = Date.now()) {
  if (state.status !== 'running' || remainingSeconds(state, now) > 0) return { state, completed: false };
  const completed = state.mode === 'focus';
  return { state: { ...state, status: 'complete', remaining: 0, endsAt: null,
    completed: completed ? [...state.completed, state.endsAt] : state.completed }, completed };
}
export function start(state, now = Date.now()) {
  if (state.status !== 'idle' && state.status !== 'paused') return state;
  if (state.remaining <= 0) return state;
  return { ...state, status: 'running', endsAt: now + state.remaining * 1000 };
}
export function pause(state, now = Date.now()) {
  if (state.status !== 'running') return state;
  const { state: settled } = settle(state, now);
  if (settled.status === 'complete') return settled;
  return { ...state, status: 'paused', remaining: remainingSeconds(state, now), endsAt: null };
}
export function reset(state) {
  return { ...state, status: 'idle', endsAt: null, remaining: state.durations[state.mode] * 60, roundDuration: state.durations[state.mode] * 60 };
}
export function switchMode(state, mode) {
  if (!MODES.includes(mode)) return state;
  return { ...state, mode, status: 'idle', endsAt: null, remaining: state.durations[mode] * 60, roundDuration: state.durations[mode] * 60 };
}
export function advance(state) {
  if (state.status !== 'complete') return state;
  return switchMode(state, nextMode(state));
}
export function changeDurations(state, value) {
  const durations = cleanDurations(value);
  return { ...state, durations, ...(state.status === 'idle' ? { remaining: durations[state.mode] * 60, roundDuration: durations[state.mode] * 60 } : {}) };
}
export function restore(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (!value || !MODES.includes(value.mode) || !['idle', 'running', 'paused', 'complete'].includes(value.status)) throw Error('invalid');
    const durations = cleanDurations(value.durations);
    const remaining = Number(value.remaining);
    const state = { mode: value.mode, status: value.status,
      remaining: Number.isFinite(remaining) && remaining >= 0 && remaining <= 5400 ? Math.ceil(remaining) : durations[value.mode] * 60,
      roundDuration: Number.isFinite(value.roundDuration) && value.roundDuration >= 60 && value.roundDuration <= 5400 ? value.roundDuration : durations[value.mode] * 60,
      endsAt: value.status === 'running' && Number.isFinite(value.endsAt) ? value.endsAt : null,
      durations,
      completed: Array.isArray(value.completed) ? value.completed.filter(n => Number.isFinite(n) && n <= now && n > 0).slice(-500) : [],
      task: typeof value.task === 'string' ? value.task.slice(0, 140) : '',
      captures: Array.isArray(value.captures) ? value.captures.filter(x => x && typeof x.text === 'string').slice(-30).map(x => ({ id: String(x.id), text: x.text.slice(0, 140) })) : [],
      sound: value.sound !== false };
    if (state.status === 'running' && !state.endsAt) return { state: { ...state, status: 'paused' }, completed: false };
    return settle(state, now);
  } catch { return { state: initialState(), completed: false }; }
}
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
