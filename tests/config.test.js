const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { loadConfig } = require('../server/config');

test('production configuration rejects placeholder values', async () => {
  const validHash = await bcrypt.hash('a-valid-test-password', 4);
  assert.throws(() => loadConfig({
    NODE_ENV: 'production',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD_HASH: validHash,
    SESSION_SECRET: 'replace_with_at_least_32_random_characters'
  }), /must be changed from the example value/);
});

test('production configuration resolves a valid deployment environment', async () => {
  const validHash = await bcrypt.hash('a-valid-test-password', 4);
  const config = loadConfig({
    NODE_ENV: 'production',
    HOST: '0.0.0.0',
    PORT: '3000',
    DATABASE_PATH: './data/test.sqlite',
    ADMIN_EMAIL: 'ops@ffmena.test',
    ADMIN_PASSWORD_HASH: validHash,
    SESSION_SECRET: 'a-unique-production-secret-with-48-characters-minimum',
    SESSION_TTL_HOURS: '12',
    ALLOWED_ORIGINS: 'https://strakhovgg.com,https://admin.strakhovgg.com',
    TRUST_PROXY: '1'
  });

  assert.equal(config.port, 3000);
  assert.equal(config.secureCookies, true);
  assert.deepEqual(config.allowedOrigins, ['https://strakhovgg.com', 'https://admin.strakhovgg.com']);
});