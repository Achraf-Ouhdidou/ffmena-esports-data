const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function createStore(databasePath) {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      logo TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      UNIQUE(tournament_id, name)
    );
    CREATE TABLE IF NOT EXISTS days (
      id TEXT PRIMARY KEY,
      phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      name TEXT NOT NULL COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      UNIQUE(phase_id, name)
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      tournament_name TEXT NOT NULL,
      phase_name TEXT NOT NULL,
      day_name TEXT NOT NULL,
      teams_json TEXT NOT NULL,
      players_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS matches_tournament_idx ON matches(tournament_id);
    CREATE INDEX IF NOT EXISTS matches_phase_idx ON matches(phase_id);
    CREATE INDEX IF NOT EXISTS matches_day_idx ON matches(day_id);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);

  const statements = {
    listTournaments: database.prepare('SELECT id, name, logo, created_at AS createdAt FROM tournaments ORDER BY created_at DESC'),
    createTournament: database.prepare('INSERT INTO tournaments (id, name, logo, created_at) VALUES (?, ?, ?, ?)'),
    updateTournamentLogo: database.prepare('UPDATE tournaments SET logo = ? WHERE id = ?'),
    deleteTournament: database.prepare('DELETE FROM tournaments WHERE id = ?'),
    getTournament: database.prepare('SELECT id, name FROM tournaments WHERE id = ?'),
    listPhases: database.prepare('SELECT id, name FROM phases WHERE tournament_id = ? ORDER BY created_at'),
    createPhase: database.prepare('INSERT INTO phases (id, tournament_id, name, created_at) VALUES (?, ?, ?, ?)'),
    deletePhase: database.prepare('DELETE FROM phases WHERE id = ? AND tournament_id = ?'),
    getPhase: database.prepare('SELECT id, name, tournament_id AS tournamentId FROM phases WHERE id = ? AND tournament_id = ?'),
    listDays: database.prepare(`
      SELECT days.id, days.name FROM days
      JOIN phases ON phases.id = days.phase_id
      WHERE days.phase_id = ? AND phases.tournament_id = ?
      ORDER BY days.created_at
    `),
    createDay: database.prepare('INSERT INTO days (id, phase_id, name, created_at) VALUES (?, ?, ?, ?)'),
    deleteDay: database.prepare(`
      DELETE FROM days WHERE id = ? AND phase_id IN (
        SELECT id FROM phases WHERE id = ? AND tournament_id = ?
      )
    `),
    getDay: database.prepare(`
      SELECT days.id, days.name FROM days
      JOIN phases ON phases.id = days.phase_id
      WHERE days.id = ? AND phases.id = ? AND phases.tournament_id = ?
    `),
    createMatch: database.prepare(`
      INSERT INTO matches (
        id, tournament_id, phase_id, day_id, tournament_name, phase_name,
        day_name, teams_json, players_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteMatch: database.prepare('DELETE FROM matches WHERE id = ?'),
    createSession: database.prepare('INSERT INTO sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)'),
    getSession: database.prepare('SELECT email, expires_at AS expiresAt FROM sessions WHERE token_hash = ? AND expires_at > ?'),
    deleteSession: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteExpiredSessions: database.prepare('DELETE FROM sessions WHERE expires_at <= ?')
  };

  function listMatches(filters = {}) {
    const conditions = [];
    const values = [];
    for (const [column, value] of [
      ['tournament_id', filters.tournamentId],
      ['phase_id', filters.phaseId],
      ['day_id', filters.dayId]
    ]) {
      if (value) {
        conditions.push(`${column} = ?`);
        values.push(value);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = database.prepare(`
      SELECT id, tournament_id AS tournamentId, phase_id AS phaseId, day_id AS dayId,
        tournament_name AS tournamentName, phase_name AS phaseName, day_name AS dayName,
        teams_json AS teamsJson, players_json AS playersJson, created_at AS createdAt
      FROM matches ${where} ORDER BY created_at DESC
    `).all(...values);
    return rows.map(({ teamsJson, playersJson, ...row }) => ({
      ...row,
      teams: JSON.parse(teamsJson),
      players: JSON.parse(playersJson)
    }));
  }

  return {
    database,
    listTournaments: () => statements.listTournaments.all(),
    createTournament: tournament => statements.createTournament.run(tournament.id, tournament.name, tournament.logo, tournament.createdAt),
    updateTournamentLogo: (id, logo) => statements.updateTournamentLogo.run(logo, id).changes,
    deleteTournament: id => statements.deleteTournament.run(id).changes,
    getTournament: id => statements.getTournament.get(id),
    listPhases: tournamentId => statements.listPhases.all(tournamentId),
    createPhase: phase => statements.createPhase.run(phase.id, phase.tournamentId, phase.name, phase.createdAt),
    deletePhase: (tournamentId, phaseId) => statements.deletePhase.run(phaseId, tournamentId).changes,
    getPhase: (tournamentId, phaseId) => statements.getPhase.get(phaseId, tournamentId),
    listDays: (tournamentId, phaseId) => statements.listDays.all(phaseId, tournamentId),
    createDay: day => statements.createDay.run(day.id, day.phaseId, day.name, day.createdAt),
    deleteDay: (tournamentId, phaseId, dayId) => statements.deleteDay.run(dayId, phaseId, tournamentId).changes,
    getDay: (tournamentId, phaseId, dayId) => statements.getDay.get(dayId, phaseId, tournamentId),
    listMatches,
    createMatch: match => statements.createMatch.run(
      match.id,
      match.tournamentId,
      match.phaseId,
      match.dayId,
      match.tournamentName,
      match.phaseName,
      match.dayName,
      JSON.stringify(match.teams),
      JSON.stringify(match.players),
      match.createdAt
    ),
    deleteMatch: id => statements.deleteMatch.run(id).changes,
    createSession: session => statements.createSession.run(session.tokenHash, session.email, session.expiresAt, session.createdAt),
    getSession: (tokenHash, now) => statements.getSession.get(tokenHash, now),
    deleteSession: tokenHash => statements.deleteSession.run(tokenHash),
    deleteExpiredSessions: now => statements.deleteExpiredSessions.run(now),
    ping: () => database.prepare('SELECT 1 AS ok').get().ok === 1,
    close: () => database.close()
  };
}

module.exports = { createStore };