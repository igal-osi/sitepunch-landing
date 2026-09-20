const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FALLBACK_CATALOG,
  getCommercialCatalog,
  __resetCommercialCatalogCache,
} = require('../api/commercial-catalog');
const pricingHandler = require('../api/commercial-pricing');

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
};

function payload(overrides = {}) {
  return {
    revision_id: '123e4567-e89b-12d3-a456-426614174000',
    currency: 'ILS',
    terms_version: '2026-09-20',
    terms_url: 'https://sitepunch.co.il/terms.html',
    terms_content_hash: 'db1523117f5f094d40ad9ac0f050fd2f7738d03dbf473b4258a225d5ad8b98f7',
    prices: [
      ...Object.entries({
        starter_monthly: ['starter', 'monthly', 14900], starter_annual: ['starter', 'annual', 142800],
        pro_monthly: ['pro', 'monthly', 29900], pro_annual: ['pro', 'annual', 286800],
        enterprise_monthly: ['enterprise', 'monthly', 59900], enterprise_annual: ['enterprise', 'annual', 574800],
        operations_monthly: ['operations', 'monthly', 159000], operations_annual: ['operations', 'annual', 1526400],
        pack_1: ['pack_1', 'one_time', 19900], pack_3: ['pack_3', 'one_time', 49900], pack_10: ['pack_10', 'one_time', 129000],
        extra_proj_10: ['extra_proj_10', 'monthly', 7900], extra_proj_25: ['extra_proj_25', 'monthly', 14900],
        extra_users_10: ['extra_users_10', 'monthly', 5900], extra_users_50: ['extra_users_50', 'monthly', 19900],
      }).map(([sku_id, [product_id, billing_period, amount_minor]]) => ({ sku_id, product_id, billing_period, amount_minor })),
      { sku_id: 'future_public_sku', product_id: 'future', billing_period: 'one_time', amount_minor: 5000 },
    ],
    ...overrides,
  };
}

test('commercial catalog reads only the public RPC and projects the supported public prices', async () => {
  __resetCommercialCatalogCache();
  let request;
  const catalog = await getCommercialCatalog({
    env,
    bypassCache: true,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => payload() };
    },
  });

  assert.equal(catalog.source, 'catalog');
  assert.equal(catalog.prices.enterprise.monthly, 59900);
  assert.equal(catalog.prices.operations.annual, 1526400);
  assert.deepEqual(catalog.terms, {
    version: '2026-09-20',
    url: 'https://sitepunch.co.il/terms.html',
    contentHash: 'db1523117f5f094d40ad9ac0f050fd2f7738d03dbf473b4258a225d5ad8b98f7',
  });
  assert.equal(request.url, 'https://example.supabase.co/rest/v1/rpc/commercial_catalog_get_active');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.apikey, env.SUPABASE_ANON_KEY);
  assert.equal(request.options.headers.Authorization, `Bearer ${env.SUPABASE_ANON_KEY}`);
  assert.doesNotMatch(JSON.stringify(request.options), /service_role/i);
});

test('malformed, incomplete, unavailable, or unconfigured catalogs fall back to the approved committed pricebook', async () => {
  __resetCommercialCatalogCache();
  const malformed = payload({
    prices: payload().prices.filter((row) => row.sku_id !== 'operations_annual'),
  });
  const fromMalformed = await getCommercialCatalog({
    env,
    bypassCache: true,
    fetchImpl: async () => ({ ok: true, json: async () => malformed }),
  });
  const fromUnavailable = await getCommercialCatalog({
    env,
    bypassCache: true,
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  });
  const fromNoConfig = await getCommercialCatalog({
    env: {},
    bypassCache: true,
    fetchImpl: async () => { throw new Error('must not call upstream'); },
  });

  assert.strictEqual(fromMalformed, FALLBACK_CATALOG);
  assert.strictEqual(fromUnavailable, FALLBACK_CATALOG);
  assert.strictEqual(fromNoConfig, FALLBACK_CATALOG);
});

test('public pricing endpoint is read-only, cacheable, and serves the approved fallback without configuration', async () => {
  __resetCommercialCatalogCache();
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnon = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  const headers = {};
  let statusCode;
  let body;
  const response = {
    setHeader(name, value) { headers[name] = value; },
    status(code) { statusCode = code; return this; },
    json(value) { body = value; },
    end() {},
  };
  try {
    await pricingHandler({ method: 'GET' }, response);
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnon;
    __resetCommercialCatalogCache();
  }

  assert.equal(statusCode, 200);
  assert.strictEqual(body, FALLBACK_CATALOG);
  assert.equal(headers['X-Commercial-Pricing-Source'], 'fallback');
  assert.match(headers['Cache-Control'], /s-maxage=300/);
});
