const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { createStore } = require('./database');
const { createAuth } = require('./auth');
const { schemas, parse } = require('./validation');

function createApp({ config, store = createStore(config.databasePath), serveAdmin = true } = {}) {
  if (!config) throw new Error('Server config is required.');

  const app = express();
  const auth = createAuth({ config, store });
  const allowedOrigins = new Set(config.allowedOrigins);
  const root = path.resolve(__dirname, '..');

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((request, response, next) => {
    request.id = request.get('x-request-id') || crypto.randomUUID();
    response.set('x-request-id', request.id);
    const startedAt = Date.now();
    response.on('finish', () => {
      console.log(JSON.stringify({
        level: 'info',
        requestId: request.id,
        method: request.method,
        path: request.originalUrl.split('?')[0],
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
        actor: request.user?.email || null
      }));
    });
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ['https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed.');
      error.status = 403;
      error.code = 'ORIGIN_NOT_ALLOWED';
      callback(error);
    }
  }));
  app.use(express.json({ limit: '8mb', strict: true }));
  app.use('/api/v1/public', (request, response, next) => {
    response.set('Cache-Control', 'public, no-cache');
    next();
  });
  app.use(['/api/v1/auth', '/api/v1/admin'], (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  const standardLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false });
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
  if (config.environment !== 'test') app.use('/api/', standardLimit);

  app.get('/healthz', (request, response) => {
    response.json({ status: store.ping() ? 'ok' : 'degraded', version: '1.0.0' });
  });
  app.get('/api/v1/health', (request, response) => {
    response.json({ status: store.ping() ? 'ok' : 'degraded', version: '1.0.0' });
  });

  app.get('/api/v1/auth/session', (request, response) => {
    const user = auth.currentUser(request);
    response.json({ user });
  });
  app.post('/api/v1/auth/login', config.environment === 'test' ? [] : loginLimit, async (request, response, next) => {
    try {
      const credentials = parse(schemas.credentials, request.body);
      const user = await auth.login(credentials.email, credentials.password, response);
      if (!user) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/v1/auth/logout', (request, response) => {
    auth.logout(request, response);
    response.status(204).end();
  });

  app.get('/api/v1/public/tournaments', (request, response) => response.json(store.listTournaments()));
  app.get('/api/v1/public/tournaments/:tournamentId/phases', (request, response) => {
    response.json(store.listPhases(request.params.tournamentId));
  });
  app.get('/api/v1/public/tournaments/:tournamentId/phases/:phaseId/days', (request, response) => {
    response.json(store.listDays(request.params.tournamentId, request.params.phaseId));
  });
  app.get('/api/v1/public/matches', (request, response, next) => {
    try {
      response.json(store.listMatches(parse(schemas.filters, request.query)));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/admin', auth.requireAdmin);
  app.post('/api/v1/admin/tournaments', (request, response, next) => {
    try {
      const input = parse(schemas.tournament, request.body);
      const tournament = { id: crypto.randomUUID(), ...input, createdAt: Date.now() };
      store.createTournament(tournament);
      response.status(201).json(tournament);
    } catch (error) {
      next(error);
    }
  });
  app.put('/api/v1/admin/tournaments/:tournamentId/logo', (request, response, next) => {
    try {
      const input = parse(schemas.logo, request.body);
      if (!store.updateTournamentLogo(request.params.tournamentId, input.logo)) return notFound(response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/v1/admin/tournaments/:tournamentId', (request, response) => {
    if (!store.deleteTournament(request.params.tournamentId)) return notFound(response);
    response.status(204).end();
  });
  app.post('/api/v1/admin/tournaments/:tournamentId/phases', (request, response, next) => {
    try {
      if (!store.getTournament(request.params.tournamentId)) return notFound(response);
      const input = parse(schemas.namedEntity, request.body);
      const phase = { id: crypto.randomUUID(), tournamentId: request.params.tournamentId, name: input.name, createdAt: Date.now() };
      store.createPhase(phase);
      response.status(201).json(phase);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/v1/admin/tournaments/:tournamentId/phases/:phaseId', (request, response) => {
    if (!store.deletePhase(request.params.tournamentId, request.params.phaseId)) return notFound(response);
    response.status(204).end();
  });
  app.post('/api/v1/admin/tournaments/:tournamentId/phases/:phaseId/days', (request, response, next) => {
    try {
      if (!store.getPhase(request.params.tournamentId, request.params.phaseId)) return notFound(response);
      const input = parse(schemas.namedEntity, request.body);
      const day = { id: crypto.randomUUID(), phaseId: request.params.phaseId, name: input.name, createdAt: Date.now() };
      store.createDay(day);
      response.status(201).json(day);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/v1/admin/tournaments/:tournamentId/phases/:phaseId/days/:dayId', (request, response) => {
    if (!store.deleteDay(request.params.tournamentId, request.params.phaseId, request.params.dayId)) return notFound(response);
    response.status(204).end();
  });
  app.post('/api/v1/admin/matches', (request, response, next) => {
    try {
      const input = parse(schemas.match, request.body);
      const tournament = store.getTournament(input.tournamentId);
      const phase = store.getPhase(input.tournamentId, input.phaseId);
      const day = store.getDay(input.tournamentId, input.phaseId, input.dayId);
      if (!tournament || !phase || !day) return response.status(400).json({ error: { code: 'INVALID_RELATION', message: 'Tournament, phase, or day does not exist.' } });
      const match = {
        id: crypto.randomUUID(),
        tournamentId: tournament.id,
        phaseId: phase.id,
        dayId: day.id,
        tournamentName: tournament.name,
        phaseName: phase.name,
        dayName: day.name,
        teams: input.teams,
        players: input.players,
        createdAt: Date.now()
      };
      store.createMatch(match);
      response.status(201).json(match);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/v1/admin/matches/:matchId', (request, response) => {
    if (!store.deleteMatch(request.params.matchId)) return notFound(response);
    response.status(204).end();
  });

  if (serveAdmin) {
    const revalidate = {
      setHeaders(response) {
        response.set('Cache-Control', 'public, no-cache');
      }
    };
    app.get('/js/runtime-config.js', (request, response) => {
      response.set('Cache-Control', 'no-store');
      response.type('application/javascript').send("window.FFMENA_CONFIG = Object.freeze({ apiBaseUrl: '/api/v1' });");
    });
    app.use('/css', express.static(path.join(root, 'css'), revalidate));
    app.use('/js', express.static(path.join(root, 'js'), revalidate));
    app.get('/vendor/papaparse.min.js', (request, response) => {
      response.set('Cache-Control', 'public, max-age=31536000, immutable');
      response.sendFile(path.join(root, 'node_modules', 'papaparse', 'papaparse.min.js'));
    });
    app.get('/favicon.svg', (request, response) => {
      response.set('Cache-Control', 'public, no-cache');
      response.sendFile(path.join(root, 'favicon.svg'));
    });
    app.get(['/', '/admin.html'], (request, response) => {
      response.set('Cache-Control', 'no-store');
      response.sendFile(path.join(root, 'admin.html'));
    });
  }

  app.use('/api/', (request, response) => notFound(response));
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    const isConflict = error.code?.startsWith('ERR_SQLITE_CONSTRAINT');
    const status = error.status || (isConflict ? 409 : 500);
    const code = error.code || (isConflict ? 'CONFLICT' : 'INTERNAL_ERROR');
    if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: request.id, message: error.message, stack: error.stack }));
    response.status(status).json({
      error: {
        code,
        message: status >= 500 ? 'An unexpected server error occurred.' : error.message
      }
    });
  });

  return { app, store };
}

function notFound(response) {
  return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
}

module.exports = { createApp };