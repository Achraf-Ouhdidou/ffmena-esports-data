const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'ffmena_session';

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const separator = part.indexOf('=');
    return separator < 0
      ? [decodeURIComponent(part), '']
      : [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function tokenHash(token, secret) {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function createAuth({ config, store }) {
  function setCookie(response, token, maxAge) {
    response.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'strict',
      path: '/',
      maxAge
    });
  }

  function clearCookie(response) {
    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: 'strict',
      path: '/'
    });
  }

  function readToken(request) {
    return parseCookies(request.headers.cookie)[COOKIE_NAME] || null;
  }

  function currentUser(request) {
    const token = readToken(request);
    if (!token) return null;
    const session = store.getSession(tokenHash(token, config.sessionSecret), Date.now());
    return session ? { email: session.email } : null;
  }

  async function login(email, password, response) {
    const emailMatches = email.toLowerCase() === config.adminEmail;
    const passwordMatches = await bcrypt.compare(password, config.adminPasswordHash);
    if (!emailMatches || !passwordMatches) return null;

    const now = Date.now();
    const token = crypto.randomBytes(32).toString('base64url');
    store.deleteExpiredSessions(now);
    store.createSession({
      tokenHash: tokenHash(token, config.sessionSecret),
      email: config.adminEmail,
      createdAt: now,
      expiresAt: now + config.sessionTtlMs
    });
    setCookie(response, token, config.sessionTtlMs);
    return { email: config.adminEmail };
  }

  function logout(request, response) {
    const token = readToken(request);
    if (token) store.deleteSession(tokenHash(token, config.sessionSecret));
    clearCookie(response);
  }

  function requireAdmin(request, response, next) {
    const user = currentUser(request);
    if (!user) {
      return response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    request.user = user;
    next();
  }

  return { currentUser, login, logout, requireAdmin };
}

module.exports = { createAuth };