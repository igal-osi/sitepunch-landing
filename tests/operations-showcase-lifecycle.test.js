const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/operations-showcase.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function mount(code = source, reduced = false) {
  const replay = { disabled: true, addEventListener: (type, handler) => { replay[type] = handler; } };
  const note = {};
  const caption = {};
  let intersection, requests = 0, frameWrites = 0;
  const frames = [960, 390].map(width => ({
    dataset: { width }, style: {}, parentElement: { clientWidth: width / 2 },
    // WebKit can expose a document before its root exists during navigation.
    contentDocument: { documentElement: null },
    addEventListener() {},
    set srcdoc(value) { frameWrites++; this.markup = value; },
  }));
  const showcase = { dataset: {}, offsetWidth: 390, querySelectorAll: () => frames, querySelector: () => ({}) };
  const preference = { matches: reduced, addEventListener: (type, handler) => { preference.change = handler; } };
  const document = {
    hidden: false, body: { dataset: { product: 'operations' } }, documentElement: { lang: 'he', dataset: { theme: 'light' } }, head: {},
    querySelector: () => showcase,
    getElementById: id => ({ operationsShowcaseReplay: replay, operationsShowcaseMotionNote: note, operationsShowcaseCaption: caption }[id]),
    addEventListener() {},
  };
  vm.runInNewContext(code, {
    document, window: { matchMedia: () => preference },
    fetch: async () => { requests++; return { ok: true, json: async () => ({ css: '', screens: { he: '<main>Categories</main>' } }) }; },
    ResizeObserver: class { observe() {} }, MutationObserver: class { observe() {} },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
  });
  return { showcase, replay, note, frames, preference,
    intersect: ratio => intersection([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]),
    requests: () => requests, writes: () => frameWrites,
  };
}

test('a sliver does not consume the entrance before the scene is visible', async () => {
  const view = mount();
  view.intersect(.08);
  await flush();
  assert.equal(view.requests(), 0);
  assert.notEqual(view.showcase.dataset.ready, 'true');
  view.intersect(.4);
  await flush();
  assert.equal(view.requests(), 1);
  assert.equal(view.showcase.dataset.ready, 'true');
  assert.equal(view.writes(), 2);
});

test('negative proof: accepting any intersection reproduces the premature intro', async () => {
  const view = mount(source.replace('entry.intersectionRatio >= .4', 'entry.intersectionRatio > 0'));
  view.intersect(.08);
  await flush();
  assert.equal(view.showcase.dataset.ready, 'true');
});

test('replay restarts both frames without refetching; leaving the viewport pauses motion', async () => {
  const view = mount();
  view.intersect(.6);
  await flush();
  view.replay.click();
  await flush();
  assert.equal(view.writes(), 4);
  assert.equal(view.requests(), 1);
  view.intersect(0);
  assert.equal(view.showcase.dataset.paused, 'true');
  view.intersect(.1);
  assert.equal(view.showcase.dataset.paused, 'false');
});

test('OS reduced motion leaves content visible, explains the setting and disables replay', async () => {
  const view = mount(source, true);
  view.intersect(.5);
  await flush();
  assert.equal(view.showcase.dataset.ready, 'true');
  assert.equal(view.replay.disabled, true);
  assert.equal(view.note.hidden, false);
  assert.ok(view.frames[0].markup.includes('data-reduce-motion="true"'));
  view.replay.click();
  assert.equal(view.writes(), 2);
  view.preference.matches = false;
  view.preference.change();
  assert.equal(view.replay.disabled, false);
  assert.equal(view.note.hidden, true);
});
