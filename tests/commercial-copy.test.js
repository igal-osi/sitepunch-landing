const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const landing = readFileSync(join(root, 'index.html'), 'utf8');
const chatHandler = require(join(root, 'api', 'chat.js'));
const { FALLBACK_CATALOG } = require(join(root, 'api', 'commercial-catalog.js'));
const prompt = chatHandler.SYSTEM_PROMPT;

test('Operations fallback pricing is exact and the landing hydrates it through the read-only endpoint', () => {
  const promptDigits = prompt.replace(/[,\s]/g, '');
  for (const value of ['1,590', '15,264', '1,272', '3,816']) {
    assert.ok(landing.includes(value));
  }
  for (const value of ['1590', '15264', '1272', '3816']) {
    assert.match(promptDigits, new RegExp(value));
  }
  assert.equal(FALLBACK_CATALOG.prices.operations.monthly, 159000);
  assert.equal(FALLBACK_CATALOG.prices.operations.annual, 1526400);
  assert.match(landing, /fetch\('\/api\/commercial-pricing'/);
  assert.match(landing, /textContent/);
  assert.doesNotMatch(landing, /מעל\s*₪?\s*1[,]?500|above\s*₪?\s*1[,]?500|более\s*₪?\s*1[\s,]?500|أكثر\s*من\s*₪?\s*1[,]?500/i);
  assert.doesNotMatch(landing, /ההצטרפות כוללת אפיון והטמעה|onboarding includes scoped discovery and controlled implementation/);
  assert.match(landing, /המנוי: ₪\{monthly\} לחודש או ₪\{annual\} לשנה/);
  assert.match(prompt, /לא לנסח אותו כ״מעל״, כ״החל מ־״ או כטווח/);
});

test('SitePunch approved fallback is exact across cards, billing copy, and public AI', () => {
  const compactLanding = landing.replace(/[,\s]/g, '');
  const compactPrompt = prompt.replace(/[,\s]/g, '');

  for (const value of ['149', '299', '599', '1428', '2868', '5748']) {
    assert.match(compactLanding, new RegExp(value));
    assert.match(compactPrompt, new RegExp(value));
  }

  assert.match(landing, /starter:\s*Object\.freeze\(\{ monthly: 14900, annual: 142800 \}\)/);
  assert.match(landing, /pro:\s*Object\.freeze\(\{ monthly: 29900, annual: 286800 \}\)/);
  assert.match(landing, /enterprise:\s*Object\.freeze\(\{ monthly: 59900, annual: 574800 \}\)/);
  assert.doesNotMatch(landing, /Enterprise[^\n]{0,120}₪?799|monthly:\s*79900|annual:\s*766800/);
  assert.doesNotMatch(landing, /₪(?:349|890)|\b(?:3348|8544)\b|3,348|8,544/);
  assert.doesNotMatch(prompt, /₪(?:349|799|890)|3,348|7,668|8,544/);
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
  assert.match(source, /getCommercialCatalog/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role/);
});

test('public AI prompt uses the supplied active catalog rather than stale literals', () => {
  const activeCatalog = {
    ...FALLBACK_CATALOG,
    prices: {
      ...FALLBACK_CATALOG.prices,
      enterprise: { monthly: 59900, annual: 574800 },
      operations: { monthly: 177700, annual: 1705920 },
    },
  };
  const activePrompt = chatHandler.buildSystemPrompt(activeCatalog);
  assert.match(activePrompt, /Enterprise ₪599\/חודש/);
  assert.match(activePrompt, /₪1,777 לחודש או ₪17,059\.20 לשנה/);
  assert.doesNotMatch(activePrompt, /Enterprise ₪799\/חודש/);
});

test('customer-facing terms and the landing legal modal include the same price-reduction boundary', () => {
  const terms = readFileSync(join(root, 'terms.html'), 'utf8');
  const clause = 'חשבוניות ומסמכי מס שכבר הונפקו לא ישוכתבו';
  assert.match(terms, new RegExp(clause));
  assert.match(landing, new RegExp(clause));
  assert.match(terms, /ההפחתה תחול במועד החידוש הבא/);
});
