// ===== Data Layer =====
const DataService = {
  // ---- Tournaments ----
  async getTournaments() {
    return ApiClient.request('/public/tournaments');
  },

  async createTournament(name, logoBase64) {
    const tournament = await ApiClient.request('/admin/tournaments', {
      method: 'POST',
      body: { name, logo: logoBase64 || null }
    });
    return tournament.id;
  },

  async updateTournamentLogo(id, logoBase64) {
    await ApiClient.request(`/admin/tournaments/${encodeURIComponent(id)}/logo`, {
      method: 'PUT',
      body: { logo: logoBase64 }
    });
  },

  async deleteTournament(id) {
    await ApiClient.request(`/admin/tournaments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ---- Phases ----
  async getPhases(tournamentId) {
    return ApiClient.request(`/public/tournaments/${encodeURIComponent(tournamentId)}/phases`);
  },

  async createPhase(tournamentId, name) {
    const phase = await ApiClient.request(`/admin/tournaments/${encodeURIComponent(tournamentId)}/phases`, {
      method: 'POST',
      body: { name }
    });
    return phase.id;
  },

  async deletePhase(tournamentId, phaseId) {
    await ApiClient.request(`/admin/tournaments/${encodeURIComponent(tournamentId)}/phases/${encodeURIComponent(phaseId)}`, { method: 'DELETE' });
  },

  // ---- Days ----
  async getDays(tournamentId, phaseId) {
    return ApiClient.request(`/public/tournaments/${encodeURIComponent(tournamentId)}/phases/${encodeURIComponent(phaseId)}/days`);
  },

  async createDay(tournamentId, phaseId, name) {
    const day = await ApiClient.request(`/admin/tournaments/${encodeURIComponent(tournamentId)}/phases/${encodeURIComponent(phaseId)}/days`, {
      method: 'POST',
      body: { name }
    });
    return day.id;
  },

  async deleteDay(tournamentId, phaseId, dayId) {
    await ApiClient.request(`/admin/tournaments/${encodeURIComponent(tournamentId)}/phases/${encodeURIComponent(phaseId)}/days/${encodeURIComponent(dayId)}`, { method: 'DELETE' });
  },

  // ---- Matches ----
  async saveMatch(matchData) {
    const match = await ApiClient.request('/admin/matches', { method: 'POST', body: matchData });
    return match.id;
  },

  async getMatches(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return ApiClient.request(`/public/matches${query ? `?${query}` : ''}`);
  },

  async deleteMatch(id) {
    await ApiClient.request(`/admin/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
            survivalScore: 0,
            damage: 0,
            booyah: 0,
            matchesPlayed: 0,
            bestRank: 99
          };
        }
        const m = map[key];
        m.kills += safeNumber(t['Kill'] ?? t.kill);
        m.totalScore += safeNumber(t['Total Score'] ?? t.totalScore);
        m.survivalScore += safeNumber(t['Survival Score'] ?? t.survivalScore);
        m.damage += safeNumber(t['Damage'] ?? t.damage);
        m.booyah += safeNumber(t['BOOYAH!'] ?? t.booyah);
        m.matchesPlayed += 1;
        const rank = safeNumber(t['Match Rank'] ?? t.matchRank, 99);
        if (rank < m.bestRank) m.bestRank = rank;
      }
    }
    // Sort by total points, tiebreakers: booyahs → eliminations
    return Object.values(map).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.booyah !== a.booyah) return b.booyah - a.booyah;
      return b.kills - a.kills;
    });
  },

  aggregatePlayers(matches) {
    const map = {};
    for (const match of matches) {
      if (!match.players) continue;
      for (const p of match.players) {
        const name = p['Player Name'] || p.playerName;
        if (!name) continue;
        const teamName = p['Team Name'] || p.teamName || '';
        const key = `${teamName}\u0000${name}`;
        if (!map[key]) {
          map[key] = {
            playerName: name,
            teamName,
            kills: 0,
            damage: 0,
            assist: 0,
            knockDown: 0,
            headshots: 0,
            matchesPlayed: 0
          };
        }
        const m = map[key];
        m.kills += safeNumber(p['Kill'] ?? p.kill);
        m.damage += safeNumber(p['Damage'] ?? p.damage);
        m.assist += safeNumber(p['Assist'] ?? p.assist);
        m.knockDown += safeNumber(p['Knock Down'] ?? p.knockDown);
        m.headshots += safeNumber(p['Headshots'] ?? p.headshots);
        m.matchesPlayed += 1;
        if (p['Team Name'] || p.teamName) m.teamName = p['Team Name'] || p.teamName;
      }
    }
    return Object.values(map).sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return b.damage - a.damage;
    });
  }
};

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
