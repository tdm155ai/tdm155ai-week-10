// Debounce for gestures: a cue fires ONCE per gesture, not 30 times a second.
// `holdMs`: how long the gesture must be held before it fires (ignores one-frame flickers).
// `rearmMs`: how long it must be gone before it can fire again.
//
//   const trigger = makeTrigger();
//   every frame: if (trigger(handIsUp).fired) fireCue(...)

export function makeTrigger({ holdMs = 150, rearmMs = 500 } = {}) {
  let onSince = null;
  let offSince = null;
  let armed = true;
  return function update(active, now = performance.now()) {
    let fired = false;
    if (active) {
      offSince = null;
      onSince ??= now;
      if (armed && now - onSince >= holdMs) { armed = false; fired = true; }
    } else {
      onSince = null;
      offSince ??= now;
      if (!armed && now - offSince >= rearmMs) armed = true;
    }
    return { fired, armed, active };
  };
}

// A set of triggers, one per name (a gesture, a zone), made the first time each name is seen.
export function makeTriggers(options) {
  const triggers = new Map();
  return function update(name, active, now) {
    if (!triggers.has(name)) triggers.set(name, makeTrigger(options));
    return triggers.get(name)(active, now);
  };
}

// Send a continuous value no more than every `everyMs`, and only when it moved by `minStep`.
export function makeThrottle({ everyMs = 50, minStep = 0.01 } = {}) {
  let lastAt = 0;
  let lastValue = null;
  return function shouldSend(value, now = performance.now()) {
    if (now - lastAt < everyMs) return false;
    if (lastValue !== null && Math.abs(value - lastValue) < minStep) return false;
    lastAt = now;
    lastValue = value;
    return true;
  };
}
