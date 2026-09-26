const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const preview = JSON.parse(read('assets/operations-preview.json'));
const css = read('assets/operations-showcase.css');
const controller = read('assets/operations-showcase.js');

test('font import remains intact before the shared root theme variables', () => {
  const validPrelude = value => /^\s*@import url\('[^']+'\);\s*:root\s*\{/.test(value);
  assert.ok(validPrelude(preview.css));
  assert.ok(preview.css.includes("--sp-font-ui: 'Heebo', system-ui"));
  assert.equal(validPrelude(preview.css.replace(/@import[^;]+;/g, '')), false);
});

test('export ships four translated real module grids without executable application code', () => {
  for (const lang of ['he', 'en', 'ru', 'ar']) {
    const screen = preview.screens[lang];
    assert.equal((screen.match(/class="sp-card ops-tile /g) || []).length, 4);
    for (const category of ['quality_control', 'field_execution', 'project_management', 'safety_hse']) {
      assert.ok(screen.includes(`data-testid="ops-module-${category}"`));
    }
    assert.doesNotMatch(screen, /<script|<form|ops_module_|supabase|onClick=/i);
    assert.ok(screen.includes('sp-project-header'));
  }
  assert.notEqual(preview.screens.en, preview.screens.he);
  assert.ok(preview.css.includes('minmax(min(248px, 100%), 1fr)'));
});

test('complete phone fits inside the narrow stage, including padding and entrance settling', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 540px)'));
  const ratio = Number(mobile.match(/aspect-ratio: ([\d.]+)/)[1]);
  const phonePercent = Number(mobile.match(/ops-phone-position \{ width: (\d+)%/)[1]) / 100;
  const phoneAspect = css.match(/aspect-ratio: 390 \/ (\d+)/)[1] / 390;
  function fits(stageRatio, viewport) {
    const width = viewport * .88;
    const stageHeight = width / stageRatio;
    const phoneHeight = (width * phonePercent - 12) * phoneAspect + 12;
    // Include top offset and the final 4-degree rotation's bounding box.
    const rotatedHeight = phoneHeight * Math.cos(4 * Math.PI / 180) + width * phonePercent * Math.sin(4 * Math.PI / 180);
    return stageHeight * .03 + rotatedHeight <= stageHeight;
  }
  for (const width of [320, 375, 390, 540]) assert.ok(fits(ratio, width), `${width}px clips phone`);
  assert.equal(fits(.79, 375), false, 'negative control: previous stage must fail');
});

test('motion and clipping protections cover both outer devices and inner UI', () => {
  for (const source of [css, controller]) {
    assert.match(source, /prefers-reduced-motion\s*:\s*reduce/);
    assert.match(source, /animation:\s*none\s*!important/);
    assert.match(source, /animation-play-state:\s*paused\s*!important/);
  }
  assert.match(css, /overflow: hidden; isolation: isolate/);
  assert.match(css, /clip-path: inset\(0 round 23px\)/);
  const html = read('index.html');
  assert.equal((html.match(/sandbox="allow-same-origin"/g) || []).length, 2);
  assert.doesNotMatch(html, /sandbox="[^"]*allow-scripts/);
});
