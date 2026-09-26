const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/operations-showcase.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const element = () => ({ style: { setProperty(key, value) { this[key] = value; } } });

function mount(reduced = false) {
  const hint = {}, note = {}, caption = {}, events = {};
  let intersection, requests = 0, writes = 0, top = 900, pending = [];
  const stage = { getBoundingClientRect: () => ({ top, height: 500 }) };
  const tablet = element(), phone = element();
  const frames = [1280, 390].map(width => {
    const workspace = element(), projects = element(), card = element();
    const ui = Array.from({ length: 7 }, element);
    workspace.querySelectorAll = () => ui;
    const root = { dataset: {}, querySelector: selector => ({ '.ops-preview-workspace': workspace, '.ops-preview-project-scene': projects, '.proj-card': card }[selector]) };
    return { dataset: { width: String(width) }, style: {}, parentElement: { clientWidth: width / 2 },
      contentDocument: { documentElement: null }, root, workspace, projects, card, ui,
      addEventListener(type, handler) { this[type] = handler; },
      set srcdoc(value) { writes++; this.markup = value; },
    };
  });
  const showcase = { dataset: {}, querySelectorAll: () => frames, querySelector: selector => ({ '.ops-showcase-stage': stage, '.ops-tablet-position': tablet, '.ops-phone-position': phone }[selector]) };
  const preference = { matches: reduced, addEventListener: (_, handler) => { preference.change = handler; } };
  const document = {
    hidden: false, body: { dataset: { product: 'operations' } }, documentElement: { lang: 'he', dataset: { theme: 'light' } }, head: {},
    querySelector: () => showcase,
    getElementById: id => ({ operationsShowcaseMotionHint: hint, operationsShowcaseMotionNote: note, operationsShowcaseCaption: caption }[id]),
    addEventListener(type, handler) { events[type] = handler; },
  };
  vm.runInNewContext(source, {
    document, window: { innerHeight: 800, matchMedia: () => preference, addEventListener(type, handler) { events[type] = handler; } },
    requestAnimationFrame: handler => { pending.push(handler); return pending.length; },
    fetch: async () => { requests++; return { ok: true, json: async () => ({ css: '', screens: { he: 'MOBILE', en: 'MOBILE' }, desktopScreens: { he: 'DESKTOP', en: 'DESKTOP' }, projectScreens: { he: 'PROJECT', en: 'PROJECT' } }) }; },
    ResizeObserver: class { observe() {} }, MutationObserver: class { observe() {} },
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
  });
  const drain = () => { const work = pending; pending = []; work.forEach(handler => handler()); };
  return { showcase, frames, preference, document, hint, note,
    intersect: value => intersection([{ isIntersecting: value }]),
    async ready() { intersection([{ isIntersecting: true }]); await flush(); frames.forEach(frame => { frame.contentDocument.documentElement = frame.root; frame.load(); }); drain(); },
    scroll(progress) { top = 680 - 450 * progress; events.scroll(); }, drain,
    requests: () => requests, writes: () => writes, queued: () => pending.length,
  };
}

test('scroll progresses project press, navigation and cards, and reverses without refetch or reload', async () => {
  const view = mount();
  assert.equal(view.requests(), 0);
  await view.ready();
  assert.equal(view.showcase.dataset.progress, '0.000');
  view.scroll(.35); view.drain();
  assert.ok(Number(view.frames[0].card.style['--tap-opacity']) > .9);
  assert.equal(view.frames[0].workspace.style.opacity, '0');
  view.scroll(.8); view.drain();
  assert.equal(view.frames[0].workspace.style.opacity, '1');
  assert.equal(view.frames[0].projects.style.opacity, '0');
  assert.ok(Number(view.frames[0].ui[0].style.opacity) > Number(view.frames[0].ui[6].style.opacity));
  view.scroll(1); view.drain();
  assert.equal(view.showcase.dataset.settled, 'true');
  view.scroll(.2); view.drain();
  assert.equal(view.frames[0].projects.style.opacity, '1');
  assert.equal(view.showcase.dataset.settled, 'false');
  assert.equal(view.requests(), 1); assert.equal(view.writes(), 2);
  assert.match(view.frames[0].markup, /DESKTOP/); assert.match(view.frames[1].markup, /MOBILE/);
});

test('frames coalesce scroll events and do not advance with elapsed time or offscreen', async () => {
  const view = mount(); await view.ready();
  view.scroll(.3); view.scroll(.4); view.scroll(.5);
  assert.equal(view.queued(), 1); view.drain();
  assert.equal(view.showcase.dataset.progress, '0.500');
  await flush(); assert.equal(view.showcase.dataset.progress, '0.500');
  view.intersect(false); view.scroll(.9);
  assert.equal(view.queued(), 0); assert.equal(view.showcase.dataset.paused, 'true');
});

test('reduced motion presents the complete workspace and honors changes without reloading', async () => {
  const view = mount(true); await view.ready();
  assert.equal(view.showcase.dataset.progress, '1.000');
  assert.equal(view.showcase.dataset.settled, 'false');
  assert.equal(view.hint.hidden, true); assert.equal(view.note.hidden, false);
  assert.ok(view.frames[0].ui.every(node => node.style.opacity === '1'));
  view.preference.matches = false; view.preference.change(); view.drain();
  assert.equal(view.hint.hidden, false); assert.equal(view.note.hidden, true);
  assert.equal(view.writes(), 2);
});

test('language and theme refresh preserve scroll progress', async () => {
  const view = mount(); await view.ready(); view.scroll(.6); view.drain();
  view.document.documentElement.lang = 'en'; view.document.documentElement.dataset.theme = 'dark';
  view.preference.change(); view.drain();
  assert.equal(view.showcase.dataset.progress, '0.600');
  assert.match(view.frames[0].markup, /lang="en" dir="ltr" data-theme="dark"/);
  assert.equal(view.requests(), 1);
});
