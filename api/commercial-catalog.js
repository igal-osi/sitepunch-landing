// Read-only public commercial catalog adapter.
//
// Only the Supabase URL and its public/anon key are used here.  A service-role
// credential must never be configured for this landing endpoint.

const CACHE_TTL_MS = 60 * 1000;
const REQUIRED_PRICES = Object.freeze({
  starter: Object.freeze({ monthly: 14900, annual: 142800 }),
  pro: Object.freeze({ monthly: 29900, annual: 286800 }),
  enterprise: Object.freeze({ monthly: 59900, annual: 574800 }),
  operations: Object.freeze({ monthly: 159000, annual: 1526400 }),
});
const REQUIRED_SKUS = Object.freeze({
  starter_monthly: 14900, starter_annual: 142800,
  pro_monthly: 29900, pro_annual: 286800,
  enterprise_monthly: 59900, enterprise_annual: 574800,
  operations_monthly: 159000, operations_annual: 1526400,
  pack_1: 19900, pack_3: 49900, pack_10: 129000,
  extra_proj_10: 7900, extra_proj_25: 14900,
  extra_users_10: 5900, extra_users_50: 19900,
});
const REQUIRED_TERMS = Object.freeze({
  version: '2026-09-20',
  url: 'https://sitepunch.co.il/terms.html',
  contentHash: 'db1523117f5f094d40ad9ac0f050fd2f7738d03dbf473b4258a225d5ad8b98f7',
});

const FALLBACK_CATALOG = Object.freeze({
  source: 'fallback',
  revision: null,
  currency: 'ILS',
  prices: REQUIRED_PRICES,
  skus: REQUIRED_SKUS,
  terms: REQUIRED_TERMS,
});

const SKU_CONTRACT = Object.freeze({
  starter_monthly: ['starter', 'monthly'], starter_annual: ['starter', 'annual'],
  pro_monthly: ['pro', 'monthly'], pro_annual: ['pro', 'annual'],
  enterprise_monthly: ['enterprise', 'monthly'], enterprise_annual: ['enterprise', 'annual'],
  operations_monthly: ['operations', 'monthly'], operations_annual: ['operations', 'annual'],
  pack_1: ['pack_1', 'one_time'], pack_3: ['pack_3', 'one_time'], pack_10: ['pack_10', 'one_time'],
  extra_proj_10: ['extra_proj_10', 'monthly'], extra_proj_25: ['extra_proj_25', 'monthly'],
  extra_users_10: ['extra_users_10', 'monthly'], extra_users_50: ['extra_users_50', 'monthly'],
});

let cache = null;

function getPublicConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(url) || anonKey.length < 20) return null;
  return { url, anonKey };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateCatalogPayload(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.prices) || payload.currency !== 'ILS') return null;
  const revision = payload.revision_id;
  if (typeof revision !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(revision)) return null;
  if (typeof payload.terms_version !== 'string' || !payload.terms_version || payload.terms_version.length > 80
      || payload.terms_url !== 'https://sitepunch.co.il/terms.html'
      || typeof payload.terms_content_hash !== 'string'
      || !/^[a-f0-9]{64}$/.test(payload.terms_content_hash)) return null;

  const skus = {};
  for (const row of payload.prices) {
    if (!isPlainObject(row)) return null;
    const skuId = String(row.sku_id || '');
    const expected = SKU_CONTRACT[skuId];
    if (!expected) continue;
    if (row.product_id !== expected[0] || row.billing_period !== expected[1]) return null;
    const amount = row.amount_minor;
    if (!Number.isSafeInteger(amount) || amount < 0) return null;
    if (Object.prototype.hasOwnProperty.call(skus, skuId)) return null;
    skus[skuId] = amount;
  }

  if (!Object.keys(SKU_CONTRACT).every(key => Object.prototype.hasOwnProperty.call(skus, key))) return null;

  return Object.freeze({
    source: 'catalog',
    revision,
    currency: 'ILS',
    terms: Object.freeze({
      version: payload.terms_version,
      url: payload.terms_url,
      contentHash: payload.terms_content_hash,
    }),
    skus: Object.freeze(skus),
    prices: Object.freeze({
      starter: Object.freeze({ monthly: skus.starter_monthly, annual: skus.starter_annual }),
      pro: Object.freeze({ monthly: skus.pro_monthly, annual: skus.pro_annual }),
      enterprise: Object.freeze({ monthly: skus.enterprise_monthly, annual: skus.enterprise_annual }),
      operations: Object.freeze({ monthly: skus.operations_monthly, annual: skus.operations_annual }),
    }),
  });
}

async function fetchCatalog({ env = process.env, fetchImpl = global.fetch } = {}) {
  const config = getPublicConfig(env);
  if (!config || typeof fetchImpl !== 'function') return FALLBACK_CATALOG;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetchImpl(`${config.url}/rest/v1/rpc/commercial_catalog_get_active`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    if (!response || !response.ok) return FALLBACK_CATALOG;
    return validateCatalogPayload(await response.json()) || FALLBACK_CATALOG;
  } catch (_) {
    return FALLBACK_CATALOG;
  } finally {
    clearTimeout(timeout);
  }
}

async function getCommercialCatalog(options = {}) {
  const now = Date.now();
  if (!options.bypassCache && cache && now - cache.at < CACHE_TTL_MS) return cache.catalog;
  const catalog = await fetchCatalog(options);
  if (!options.bypassCache) cache = { at: now, catalog };
  return catalog;
}

function resetCommercialCatalogCache() {
  cache = null;
}

module.exports = {
  FALLBACK_CATALOG,
  getCommercialCatalog,
  validateCatalogPayload,
  getPublicConfig,
  __resetCommercialCatalogCache: resetCommercialCatalogCache,
};
