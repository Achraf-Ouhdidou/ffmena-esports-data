// ===== Data Layer =====
const DataService = {
  // ---- Tournaments ----
  async getTournaments() {
    const snap = await db.ref('tournaments').once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([id, v]) => ({ id, ...v }));
  },

  async createTournament(name) {
    const ref = db.ref('tournaments').push();
    await ref.set({ name, createdAt: Date.now() });
    return ref.key;
  },

  async deleteTournament(id) {
    await db.ref(`tournaments/${id}`).remove();
    // Also delete all matches in this tournament
    const snap = await db.ref('matches').orderByChild('tournamentId').equalTo(id).once('value');
    const updates = {};
    snap.forEach(child => { updates[`matches/${child.key}`] = null; });
    if (Object.keys(updates).length) await db.ref().update(updates);
  },

  // ---- Phases ----
  async getPhases(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}/phases`).once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([id, v]) => ({ id, ...v }));
  },

  async createPhase(tournamentId, name) {
    const ref = db.ref(`tournaments/${tournamentId}/phases`).push();
    await ref.set({ name });
    return ref.key;
  },

  async deletePhase(tournamentId, phaseId) {
    await db.ref(`tournaments/${tournamentId}/phases/${phaseId}`).remove();
  },

  // ---- Days ----
  async getDays(tournamentId, phaseId) {
    const snap = await db.ref(`tournaments/${tournamentId}/phases/${phaseId}/days`).once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([id, v]) => ({ id, ...v }));
  },

  async createDay(tournamentId, phaseId, name) {
    const ref = db.ref(`tournaments/${tournamentId}/phases/${phaseId}/days`).push();
    await ref.set({ name });
    return ref.key;
  },

  async deleteDay(tournamentId, phaseId, dayId) {
    await db.ref(`tournaments/${tournamentId}/phases/${phaseId}/days/${dayId}`).remove();
  },

  // ---- Matches ----
  async saveMatch(matchData) {
    const ref = db.ref('matches').push();
    await ref.set({ ...matchData, createdAt: Date.now() });
    return ref.key;
  },

  async getMatches(filters = {}) {
    let query = db.ref('matches');
    const snap = await query.once('value');
    const data = snap.val() || {};
    let matches = Object.entries(data).map(([id, v]) => ({ id, ...v }));

    if (filters.tournamentId) matches = matches.filter(m => m.tournamentId === filters.tournamentId);
    if (filters.phaseId) matches = matches.filter(m => m.phaseId === filters.phaseId);
    if (filters.dayId) matches = matches.filter(m => m.dayId === filters.dayId);

    return matches;
  },

  async deleteMatch(id) {
    await db.ref(`matches/${id}`).remove();
  },

  // ---- Aggregation ----
  aggregateTeams(matches) {
    const map = {};
    for (const match of matches) {
      if (!match.teams) continue;
      for (const t of match.teams) {
        const key = t['Team Name'] || t.teamName;
        if (!key) continue;
        if (!map[key]) {
          map[key] = {
            teamName: key,
            kills: 0,
            totalScore: 0,
            damage: 0,
            booyah: 0,
            matchesPlayed: 0,
            bestRank: 99,
            survivalTime: 0,
            revivals: 0,
            rescues: 0
          };
        }
        const m = map[key];
        m.kills += parseInt(t['Kill'] || t.kill || 0);
        m.totalScore += parseInt(t['Total Score'] || t.totalScore || 0);
        m.damage += parseInt(t['Damage'] || t.damage || 0);
        m.booyah += parseInt(t['BOOYAH!'] || t.booyah || 0);
        m.matchesPlayed += 1;
        const rank = parseInt(t['Match Rank'] || t.matchRank || 99);
        if (rank < m.bestRank) m.bestRank = rank;
        m.survivalTime += parseInt(t['Survival Time'] || t.survivalTime || 0);
        m.revivals += parseInt(t['Revival'] || t.revival || 0);
        m.rescues += parseInt(t['Rescue Members'] || t.rescueMembers || 0);
      }
    }
    return Object.values(map).sort((a, b) => b.kills - a.kills);
  },

  aggregatePlayers(matches) {
    const map = {};
    for (const match of matches) {
      if (!match.players) continue;
      for (const p of match.players) {
        const name = p['Player Name'] || p.playerName;
        if (!name) continue;
        const key = name;
        if (!map[key]) {
          map[key] = {
            playerName: name,
            teamName: p['Team Name'] || p.teamName || '',
            kills: 0,
            damage: 0,
            assist: 0,
            knockDown: 0,
            headshots: 0,
            matchesPlayed: 0,
            survivalTime: 0,
            revivals: 0,
            rescues: 0,
            maxKillDistance: 0
          };
        }
        const m = map[key];
        m.kills += parseInt(p['Kill'] || p.kill || 0);
        m.damage += parseInt(p['Damage'] || p.damage || 0);
        m.assist += parseInt(p['Assist'] || p.assist || 0);
        m.knockDown += parseInt(p['Knock Down'] || p.knockDown || 0);
        m.headshots += parseInt(p['Headshots'] || p.headshots || 0);
        m.matchesPlayed += 1;
        m.survivalTime += parseInt(p['Survival Time'] || p.survivalTime || 0);
        m.revivals += parseInt(p['Revival'] || p.revival || 0);
        m.rescues += parseInt(p['Rescue Members'] || p.rescueMembers || 0);
        const dist = parseInt(p['Maximum kill distance'] || p.maxKillDistance || 0);
        if (dist > m.maxKillDistance) m.maxKillDistance = dist;
        // Keep latest team name
        if (p['Team Name'] || p.teamName) m.teamName = p['Team Name'] || p.teamName;
      }
    }
    return Object.values(map).sort((a, b) => b.kills - a.kills);
  }
};
