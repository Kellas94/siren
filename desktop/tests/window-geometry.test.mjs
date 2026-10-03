import test from 'node:test';
import assert from 'node:assert/strict';

// A missing implementation is an assertion failure, not an import-loader error.
const geometry = await import('../src/windows/geometry.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
function restore(snapshot, displays) {
  assert.equal(typeof geometry.restoreBounds, 'function', 'restoreBounds must implement the geometry contract');
  return geometry.restoreBounds(snapshot, displays);
}
const display = (id, x, y, width, height, extra = {}) => ({ id, workArea: { x, y, width, height }, ...extra });
const bounds = (x, y, width, height) => ({ x, y, width, height });

test('preserves reachable negative DIP coordinates on a monitor left of origin', () => {
  assert.deepEqual(restore({ normalBounds: bounds(-1700, 80, 1000, 700), displayId: 2 }, [
    display(1, 0, 0, 1920, 1040, { primary: true }), display(2, -1920, 0, 1920, 1040),
  ]), { normalBounds: bounds(-1700, 80, 1000, 700), displayId: 2, maximized: false, fullscreen: false });
});

test('uses workArea DIP unchanged across 100, 150 and 200 percent scaling', () => {
  for (const scaleFactor of [1, 1.5, 2]) {
    assert.deepEqual(restore({ normalBounds: bounds(150, 70, 900, 600) }, [
      display(4, 100, 40, 1200, 800, { scaleFactor }),
    ]).normalBounds, bounds(150, 70, 900, 600));
  }
});

test('current overlap outranks a stale display hint and largest overlap chooses the monitor', () => {
  const displays = [display(1, 0, 0, 1200, 900, { primary: true }), display(2, -1200, 0, 1200, 900)];
  assert.equal(restore({ normalBounds: bounds(-1000, 20, 800, 600), displayId: 1 }, displays).displayId, 2);
  assert.deepEqual(restore({ normalBounds: bounds(-600, 20, 1000, 600), displayId: 1 }, displays).normalBounds,
    bounds(-1000, 20, 1000, 600));
});

test('display hint breaks equal overlaps and otherwise primary breaks ties', () => {
  const displays = [display(1, -1000, 0, 1000, 800), display(2, 0, 0, 1000, 800, { primary: true })];
  assert.equal(restore({ normalBounds: bounds(-500, 50, 1000, 600), displayId: 1 }, displays).displayId, 1);
  assert.equal(restore({ normalBounds: bounds(-500, 50, 1000, 600) }, displays).displayId, 2);
});

test('removed monitor rehomes offscreen normal bounds to the primary workArea', () => {
  assert.deepEqual(restore({ normalBounds: bounds(-1900, -100, 1000, 700), displayId: 99 }, [
    display(5, 1920, 100, 1280, 800), display(1, 0, 40, 1440, 860, { primary: true }),
  ]).normalBounds, bounds(0, 40, 1000, 700));
});

test('existing display hint rehomes an offscreen window to that display', () => {
  assert.deepEqual(restore({ normalBounds: bounds(6000, 6000, 600, 400), displayId: 5 }, [
    display(1, 0, 0, 1440, 900, { primary: true }), display(5, -1280, -100, 1280, 800),
  ]).normalBounds, bounds(-600, 300, 600, 400));
});

test('taskbar and resolution changes keep the titlebar and entire normal window reachable', () => {
  assert.deepEqual(restore({ normalBounds: bounds(40, 0, 1800, 1050), displayId: 1 }, [
    display(1, 80, 40, 1280, 720),
  ]).normalBounds, bounds(80, 40, 1280, 720));
  assert.deepEqual(restore({ normalBounds: bounds(1200, 900, 600, 400) }, [display(1, 0, 50, 1400, 850)]).normalBounds,
    bounds(800, 500, 600, 400));
});

test('tiny workAreas win over default or remembered sizes without an offscreen minimum', () => {
  const displays = [display(8, -5, -7, 9, 3)];
  assert.deepEqual(restore({}, displays).normalBounds, bounds(-5, -7, 9, 3));
  assert.deepEqual(restore({ normalBounds: bounds(100, 100, 2000, 1000) }, displays).normalBounds, bounds(-5, -7, 9, 3));
});

test('malformed saved bounds fall back to centered capped defaults', () => {
  const displays = [display(3, -100, 50, 1400, 900, { primary: true })];
  for (const normalBounds of [undefined, null, [], {}, bounds(NaN, 0, 600, 400), bounds(Infinity, 0, 600, 400),
    bounds(0, 0, 0, 400), bounds(0, 0, -1, 400), bounds(0, 0, '600', 400),
    bounds(Number.MAX_SAFE_INTEGER, 0, 600, 400)]) {
    assert.deepEqual(restore({ normalBounds }, displays).normalBounds, bounds(120, 180, 960, 640));
  }
});

test('fractional stored bounds round to DIP integers and fractional workAreas round inward', () => {
  assert.deepEqual(restore({ normalBounds: bounds(-20.4, 5.6, 80.6, 50.2) }, [
    display(7, -10.2, 10.2, 100.4, 90.4),
  ]).normalBounds, bounds(-10, 11, 81, 50));
});

test('maximized and fullscreen restoration retains a usable normal rectangle and literal flags', () => {
  const displays = [display(1, 0, 40, 1000, 700)];
  assert.deepEqual(restore({ normalBounds: bounds(-3000, 0, 800, 600), displayId: 99, maximized: true, fullscreen: true }, displays),
    { normalBounds: bounds(0, 40, 800, 600), displayId: 1, maximized: true, fullscreen: true });
  assert.deepEqual(restore({ maximized: 'true', fullscreen: 1 }, displays),
    { normalBounds: bounds(20, 70, 960, 640), displayId: 1, maximized: false, fullscreen: false });
});

test('invalid displays are excluded and no usable current display is an explicit failure', () => {
  const invalid = [null, {}, display({}, 0, 0, 100, 100), display(1, 0, 0, 0, 100), display(2, NaN, 0, 100, 100),
    display(3, Number.MAX_SAFE_INTEGER, 0, 100, 100)];
  assert.equal(restore({}, [...invalid, display(9, 0, 0, 1000, 800)]).displayId, 9);
  for (const displays of [undefined, null, {}, [], invalid]) {
    assert.throws(() => restore({}, displays), error => error instanceof RangeError && error.code === 'NO_USABLE_DISPLAY');
  }
});

test('restoration neither mutates inputs nor reads or copies unrelated content', () => {
  const normalBounds = Object.freeze(bounds(-10000, -10000, 600, 400));
  const snapshot = Object.freeze({ normalBounds, displayId: 8, maximized: true,
    get sourceText() { throw new Error('geometry must not touch source text'); }, draft: Object.freeze({ text: 'retained draft' }) });
  const displays = Object.freeze([Object.freeze({ id: 1, workArea: Object.freeze(bounds(0, 0, 1200, 800)) })]);
  const result = restore(snapshot, displays);
  assert.deepEqual(result, { normalBounds: bounds(0, 0, 600, 400), displayId: 1, maximized: true, fullscreen: false });
  assert.notEqual(result.normalBounds, normalBounds);
  assert.equal(snapshot.draft.text, 'retained draft');
  assert.deepEqual(normalBounds, bounds(-10000, -10000, 600, 400));
});

test('malformed numeric fields cannot execute coercion or accessor code', () => {
  const displays = [display(3, -100, 50, 1400, 900)];
  const hostileNumber = { valueOf() { throw new Error('numeric coercion must not execute'); } };
  const hostileBounds = { get x() { throw new Error('geometry accessor must not execute'); }, y: 0, width: 600, height: 400 };
  for (const normalBounds of [bounds(Symbol('x'), 0, 600, 400), bounds(0, 0, hostileNumber, 400), hostileBounds]) {
    assert.deepEqual(restore({ normalBounds }, displays).normalBounds, bounds(120, 180, 960, 640));
  }
  assert.deepEqual(restore({ normalBounds: bounds(0, 0, 600, 400) }, [
    display(1, Symbol('invalid'), 0, 100, 100), display(3, -100, 50, 1400, 900),
  ]).normalBounds, bounds(0, 50, 600, 400));
});

test('varied disconnected and changed layouts always contain the restored normal window', () => {
  let seed = 0x51a3;
  const next = limit => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  for (let index = 0; index < 500; index++) {
    const displays = [
      display(1, -2500 + next(500), -500 + next(300), 1 + next(1800), 1 + next(1200), { scaleFactor: 1 }),
      display(2, next(300), next(100), 1 + next(2000), 1 + next(1300), { scaleFactor: 1.5, primary: true }),
      display(3, 2500 + next(300), -800 + next(500), 1 + next(1400), 1 + next(1000), { scaleFactor: 2 }),
    ];
    const original = { normalBounds: bounds(next(12000) - 6000, next(7000) - 3500, 1 + next(5000), 1 + next(4000)),
      displayId: next(5), maximized: index % 2 === 0, fullscreen: index % 3 === 0 };
    const copy = structuredClone(original);
    const result = restore(original, displays);
    const area = displays.find(current => current.id === result.displayId).workArea;
    const rect = result.normalBounds;
    assert.ok(rect.width > 0 && rect.height > 0);
    assert.ok(rect.x >= area.x && rect.y >= area.y);
    assert.ok(rect.x + rect.width <= area.x + area.width);
    assert.ok(rect.y + rect.height <= area.y + area.height);
    // The top strip remains on screen even when its height exceeds a tiny area.
    assert.ok(Math.min(rect.y + 32, area.y + area.height) > Math.max(rect.y, area.y));
    assert.equal(result.maximized, original.maximized);
    assert.equal(result.fullscreen, original.fullscreen);
    assert.deepEqual(original, copy);
  }
});
