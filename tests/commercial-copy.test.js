const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const landing = readFileSync(join(root, 'index.html'), 'utf8');
const chatHandler = require(join(root, 'api', 'chat.js'));
const prompt = chatHandler.SYSTEM_PROMPT;

test('Operations pricing is exact and consistent across landing and chat', () => {
  const promptDigits = prompt.replace(/[,\s]/g, '');
  for (const value of ['1590', '15264', '1272', '3816']) {
    assert.match(landing, new RegExp(`\\b${value}\\b`));
    assert.match(promptDigits, new RegExp(value));
  }
  assert.doesNotMatch(landing, /מעל 1,500|above ₪1,500|более ₪1 500|أكثر من ₪1,500/);
});

test('SitePunch reduced pricing is exact across cards, billing copy, and public AI', () => {
  const compactLanding = landing.replace(/[,\s]/g, '');
  const compactPrompt = prompt.replace(/[,\s]/g, '');

  for (const value of ['149', '299', '799', '1428', '2868', '7668']) {
    assert.match(compactLanding, new RegExp(value));
    assert.match(compactPrompt, new RegExp(value));
  }

  assert.match(landing, /pro:\s*\{\s*monthly:\s*299,\s*annual:\s*239\s*\}/);
  assert.match(landing, /ent:\s*\{\s*monthly:\s*799,\s*annual:\s*639\s*\}/);
  assert.doesNotMatch(landing, /₪(?:349|890)|\b(?:3348|8544)\b|3,348|8,544/);
  assert.doesNotMatch(prompt, /₪(?:349|890)|3,348|8,544/);
});

test('public AI distinguishes the two products and preserves launch status', () => {
  assert.match(prompt, /SitePunch הוא מוצר פעיל/);
  assert.match(prompt, /SitePunch Operations הוא מוצר נפרד/);
  assert.match(prompt, /Quality Control/);
  assert.match(prompt, /Field Execution/);
  assert.match(prompt, /Project Management/);
  assert.match(prompt, /Safety\/HSE/);
  assert.match(prompt, /גישה מוקדמת/);
});

test('public AI does not advertise stale billing or translation claims', () => {
  assert.doesNotMatch(prompt, /הפיצ'ר פעיל לכלל הלקוחות/);
  assert.doesNotMatch(prompt, /חשבונית מס ישראלית אוטומטית לכל תשלום/);
  assert.match(prompt, /תרגום אוטומטי של הכותרת והתיאור של ליקוי זמין רק לליקויים במסלול SitePunch Enterprise/);
  assert.match(prompt, /החיוב מטופל כיום בתהליך מסחרי ידני/);
  assert.doesNotMatch(landing, /כל לקוח מקבל חשבונית מס ישראלית לכל חיוב/);
  assert.match(landing, /חיבור עדכוני WhatsApp נמצא בהכנה ואינו שירות פעיל כרגע/);
});

test('OpenAI endpoint, model, and request budget remain unchanged', () => {
  const source = readFileSync(join(root, 'api', 'chat.js'), 'utf8');
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/chat\/completions/);
  assert.match(source, /model: 'gpt-5\.6-luna'/);
  assert.match(source, /max_completion_tokens: 260/);
});
