const path = require('node:path');
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/ffmena.sqlite'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, 'must be a bcrypt hash'),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(168).default(12),
  ALLOWED_ORIGINS: z.string().default('https://strakhovgg.com,https://www.strakhovgg.com,https://admin.strakhovgg.com'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1)
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  if (value.ADMIN_EMAIL.endsWith('@example.com')) {
    context.addIssue({ code: 'custom', path: ['ADMIN_EMAIL'], message: 'must be changed from the example value' });
  }
  if (value.SESSION_SECRET.includes('replace_with')) {
    context.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'must be changed from the example value' });
  }
});

function loadConfig(environment = process.env) {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid server configuration: ${details}`);
  }

  return {
    environment: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    databasePath: path.resolve(parsed.data.DATABASE_PATH),
    adminEmail: parsed.data.ADMIN_EMAIL.toLowerCase(),
    adminPasswordHash: parsed.data.ADMIN_PASSWORD_HASH,
    sessionSecret: parsed.data.SESSION_SECRET,
    sessionTtlMs: parsed.data.SESSION_TTL_HOURS * 60 * 60 * 1000,
    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
    trustProxy: parsed.data.TRUST_PROXY,
    secureCookies: parsed.data.NODE_ENV === 'production'
  };
}

module.exports = { loadConfig };