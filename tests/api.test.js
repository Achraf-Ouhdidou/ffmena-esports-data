const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createApp } = require('../server/app');

async function createTestServer(overrides = {}) {
  const password = 'Correct Horse Battery Staple';
  const config = {
    environment: 'test',
    databasePath: ':memory:',
    adminEmail: 'admin@ffmena.test',
    adminPasswordHash: await bcrypt.hash(password, 4),
    sessionSecret: 'test-session-secret-with-at-least-32-characters',
    sessionTtlMs: 60 * 60 * 1000,
    allowedOrigins: ['https://strakhovgg.com', 'https://admin.strakhovgg.com'],
    trustProxy: 0,
    secureCookies: false,
    ...overrides
  };
  return { ...createApp({ config, serveAdmin: false }), password };
}

test('health and public reads work without authentication', async t => {
  const { app, store } = await createTestServer();
  t.after(() => store.close());

  await request(app).get('/healthz').expect(200, { status: 'ok', version: '1.0.0' });
  await request(app).get('/api/v1/public/tournaments').expect(200, []);
  await request(app).get('/api/v1/admin/tournaments').expect(401);
});

test('admin lifecycle persists public tournament data and cascades deletion', async t => {
  const { app, store, password } = await createTestServer();
  t.after(() => store.close());
  const agent = request.agent(app);

  await agent.post('/api/v1/auth/login').send({ email: 'admin@ffmena.test', password: 'wrong-password' }).expect(401);
  const login = await agent.post('/api/v1/auth/login').send({ email: 'admin@ffmena.test', password }).expect(200);
  assert.equal(login.body.user.email, 'admin@ffmena.test');
  await agent.get('/api/v1/auth/session').expect(200);

  const tournament = (await agent.post('/api/v1/admin/tournaments').send({ name: 'FFMEA Community Cup', logo: null }).expect(201)).body;
  const phase = (await agent.post(`/api/v1/admin/tournaments/${tournament.id}/phases`).send({ name: 'Finals' }).expect(201)).body;
  const day = (await agent.post(`/api/v1/admin/tournaments/${tournament.id}/phases/${phase.id}/days`).send({ name: 'Day 1' }).expect(201)).body;

  const matchPayload = {
    tournamentId: tournament.id,
    phaseId: phase.id,
    dayId: day.id,
    tournamentName: 'Client value is ignored',
    phaseName: 'Client value is ignored',
    dayName: 'Client value is ignored',
    teams: [{ 'Team Name': 'Atlas', 'Kill': 11, 'Total Score': 23, 'Survival Score': 12, 'Damage': 6494, 'BOOYAH!': 1, 'Match Rank': 1 }],
    players: [{ 'Player Name': 'Player One', 'Team Name': 'Atlas', 'Kill': 5, 'Damage': 2079, 'Assist': 2, 'Knock Down': 5, 'Headshots': 2 }]
  };
  const invalidMatch = structuredClone(matchPayload);
  invalidMatch.teams[0].Kill = -1;
  await agent.post('/api/v1/admin/matches').send(invalidMatch).expect(400);

  const match = (await agent.post('/api/v1/admin/matches').send(matchPayload).expect(201)).body;
  assert.equal(match.tournamentName, 'FFMEA Community Cup');

  const publicMatches = await request(app).get(`/api/v1/public/matches?tournamentId=${tournament.id}`).expect(200);
  assert.equal(publicMatches.body.length, 1);
  assert.equal(publicMatches.body[0].teams[0]['Team Name'], 'Atlas');

  await agent.delete(`/api/v1/admin/tournaments/${tournament.id}`).expect(204);
  await request(app).get('/api/v1/public/matches').expect(200, []);
  await request(app).get('/api/v1/public/tournaments').expect(200, []);
  await agent.post('/api/v1/auth/logout').expect(204);
  await agent.get('/api/v1/auth/session').expect(200, { user: null });
});

test('validation and CORS reject unsafe requests', async t => {
  const { app, store } = await createTestServer();
  t.after(() => store.close());

  await request(app).get('/api/v1/public/tournaments').set('Origin', 'https://attacker.example').expect(403);
  await request(app).post('/api/v1/auth/login').send({ email: 'invalid', password: '' }).expect(400);
});

test('sessions expire and production cookies carry security attributes', async t => {
  const expiring = await createTestServer({ sessionTtlMs: -1 });
  t.after(() => expiring.store.close());
  const expiringAgent = request.agent(expiring.app);
  await expiringAgent.post('/api/v1/auth/login').send({ email: 'admin@ffmena.test', password: expiring.password }).expect(200);
  await expiringAgent.get('/api/v1/auth/session').expect(200, { user: null });

  const secure = await createTestServer({ secureCookies: true });
  t.after(() => secure.store.close());
  const response = await request(secure.app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@ffmena.test', password: secure.password })
    .expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
});

test('login endpoint rate limits repeated attempts outside test mode', async t => {
  const { app, store } = await createTestServer({ environment: 'development' });
  t.after(() => store.close());

  for (let attempt = 0; attempt < 10; attempt++) {
    await request(app).post('/api/v1/auth/login').send({ email: 'admin@ffmena.test', password: 'wrong' }).expect(401);
  }
  await request(app).post('/api/v1/auth/login').send({ email: 'admin@ffmena.test', password: 'wrong' }).expect(429);
});