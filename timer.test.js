import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, cleanDurations, start, pause, settle, reset, switchMode, advance, changeDurations, restore, remainingSeconds, bonusSeconds, formatTime, nextMode } from './timer.js';
const T = 1_700_000_000_000;
test('starts, pauses, resumes using wall time, including a sleeping tab', () => {
  const running = start(initialState(), T);
  assert.equal(remainingSeconds(running, T + 61_000), 1439);
  const paused = pause(running, T + 61_000);
  assert.equal(paused.remaining, 1439);
  assert.equal(remainingSeconds(paused, T + 5_000_000), 1439);
  const resumed = start(paused, T + 5_000_000);
  assert.equal(remainingSeconds(resumed, T + 5_001_000), 1438);
  assert.equal(settle(resumed, resumed.endsAt - 1).completed, false);
  const done = settle(resumed, resumed.endsAt + 60_000);
  assert.equal(done.completed, true);
  assert.equal(done.state.completed[0], resumed.endsAt);
  assert.equal(settle(done.state, T + 10_000_000).state.completed.length, 1);
});
test('only completed focus rounds count and fourth gets long break', () => {
  let state = initialState({ focus: 2, short: 1, long: 5 });
  for (let i = 1; i <= 4; i++) {
    state = settle(start(state, T + i * 1_000_000), T + i * 1_000_000 + 120_000).state;
    assert.equal(state.completed.length, i);
    assert.equal(nextMode(state), i === 4 ? 'long' : 'short');
    state = advance(state);
    assert.equal(state.mode, i === 4 ? 'long' : 'short');
    state = settle(start(state, T + i * 1_000_000 + 130_000), T + i * 1_000_000 + 450_000).state;
    assert.equal(state.completed.length, i);
    state = advance(state);
  }
  assert.equal(state.mode, 'focus');
  assert.equal(nextMode(state), 'short');
});
test('manual skip and reset do not award credit', () => {
  const running = start(initialState(), T);
  const skipped = switchMode(running, 'short', T + 10_000);
  assert.deepEqual(skipped.completed, []);
  assert.equal(reset(skipped).remaining, 300);
  assert.equal(advance(running), running);
});
test('validates durations and preserves a running round duration', () => {
  assert.deepEqual(cleanDurations({ focus: -2, short: 31, long: '15' }), { focus: 25, short: 5, long: 15 });
  const running = start(initialState(), T);
  const changed = changeDurations(running, { focus: 2, short: 1, long: 5 });
  assert.equal(changed.endsAt, running.endsAt);
  assert.equal(changed.remaining, 1500);
  assert.equal(changed.roundDuration, 1500);
  assert.equal(restore(JSON.stringify(changed), T + 1_000).state.roundDuration, 1500);
  assert.equal(changeDurations(initialState(), { focus: 2, short: 1, long: 5 }).remaining, 120);
  assert.equal(formatTime(61), '01:01');
});
test('restores expired rounds once and tolerates corrupt storage', () => {
  const running = start(initialState({ focus: 2, short: 1, long: 5 }), T);
  const restored = restore(JSON.stringify(running), T + 200_000);
  assert.equal(restored.state.status, 'overtime');
  assert.deepEqual(restored.state.completed, [T + 120_000]);
  assert.equal(restore(JSON.stringify(restored.state), T + 500_000).state.completed.length, 1);
  assert.equal(restore('{nope').state.status, 'idle');
  assert.equal(restore(JSON.stringify({ ...running, completed: ['oops'], captures: [{ id: 1, text: '<script>' }] }), T + 20_000).state.captures[0].text, '<script>');
});

test('focus keeps counting bonus time after zero, survives reload and pause, and credits once', () => {
  const running = start(initialState({ focus: 2, short: 1, long: 5 }), T);
  const atZero = settle(running, T + 120_000);
  assert.equal(atZero.completed, true);
  assert.equal(atZero.state.status, 'overtime');
  assert.equal(atZero.state.completed.length, 1);
  assert.equal(bonusSeconds(atZero.state, T + 151_000), 31);
  assert.equal(settle(atZero.state, T + 160_000).state.completed.length, 1);
  const restored = restore(JSON.stringify(running), T + 151_000);
  assert.equal(restored.state.status, 'overtime');
  assert.equal(bonusSeconds(restored.state, T + 151_000), 31);
  const paused = pause(restored.state, T + 151_000);
  assert.equal(paused.status, 'paused-overtime');
  assert.equal(bonusSeconds(paused, T + 500_000), 31);
  const resumed = start(paused, T + 500_000);
  assert.equal(bonusSeconds(resumed, T + 504_000), 35);
  assert.equal(restore(JSON.stringify(resumed), T + 504_000).state.completed.length, 1);
  assert.equal(advance(resumed).mode, 'short');
  assert.equal(reset(resumed).completed.length, 1);
  assert.deepEqual(reset(running, T + 120_001).completed, [T + 120_000], 'late reset still credits the finished focus round');
  const skippedLate = switchMode(running, 'short', T + 120_001);
  assert.deepEqual(skippedLate.completed, [T + 120_000], 'late mode switch also credits the round');
});

test('breaks still stop at zero rather than accruing bonus time', () => {
  const breakRound = start(switchMode(initialState(), 'short'), T);
  const done = settle(breakRound, breakRound.endsAt + 30_000);
  assert.equal(done.state.status, 'complete');
  assert.equal(done.state.remaining, 0);
});
