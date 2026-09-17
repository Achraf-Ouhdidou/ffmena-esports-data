const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadService() {
  const requests = [];
  const context = {
    URLSearchParams,
    ApiClient: {
      url(assetPath) {
        return `https://api.example.test${assetPath}`;
      },
      async request(requestPath, options) {
        requests.push({ path: requestPath, options });
        if (requestPath === '/public/tournaments') {
          return [{ id: 'tournament1', name: 'Community Cup', logoUrl: '/api/v1/public/tournaments/tournament1/logo' }];
        }
        if (requestPath.startsWith('/admin/tournaments') && options?.method === 'POST') return { id: 'new-id' };
        if (requestPath === '/admin/matches' && options?.method === 'POST') return { id: 'match-id' };
        return null;
      }
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'data.js'), 'utf8');
  vm.runInContext(`${source};globalThis.service=DataService`, context);
  return { service: context.service, requests };
}

test('DataService maps public reads and admin writes to the versioned API', async () => {
  const { service, requests } = loadService();

  const tournaments = await service.getTournaments();
  assert.equal(tournaments[0].logo, 'https://api.example.test/api/v1/public/tournaments/tournament1/logo');
  await service.getMatches({ tournamentId: 'tournament 1', dayId: 'day1' });
  assert.equal(await service.createTournament('Community Cup', null), 'new-id');
  assert.equal(await service.saveMatch({ teams: [], players: [] }), 'match-id');
  await service.deleteDay('tournament1', 'phase1', 'day1');

  assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
    { path: '/public/tournaments' },
    { path: '/public/matches?tournamentId=tournament+1&dayId=day1' },
    { path: '/admin/tournaments', options: { method: 'POST', body: { name: 'Community Cup', logo: null } } },
    { path: '/admin/matches', options: { method: 'POST', body: { teams: [], players: [] } } },
    { path: '/admin/tournaments/tournament1/phases/phase1/days/day1', options: { method: 'DELETE' } }
  ]);
});

test('leaderboard aggregation remains deterministic', () => {
  const { service } = loadService();
  const matches = [{
    teams: [
      { 'Team Name': 'Atlas', 'Kill': 4, 'Total Score': 10, 'Survival Score': 6, 'Damage': 500, 'BOOYAH!': 0, 'Match Rank': 2 },
      { 'Team Name': 'Ravens', 'Kill': 6, 'Total Score': 10, 'Survival Score': 4, 'Damage': 700, 'BOOYAH!': 1, 'Match Rank': 1 }
    ],
    players: [
      { 'Player Name': 'Ace', 'Team Name': 'Atlas', 'Kill': 3, 'Damage': 400, 'Assist': 1, 'Knock Down': 2, 'Headshots': 1 },
      { 'Player Name': 'Ace', 'Team Name': 'Ravens', 'Kill': 4, 'Damage': 450, 'Assist': 2, 'Knock Down': 3, 'Headshots': 2 }
    ]
  }];

  assert.deepEqual(JSON.parse(JSON.stringify(service.aggregateTeams(matches))).map(team => team.teamName), ['Ravens', 'Atlas']);
  assert.equal(service.aggregatePlayers(matches).length, 2);
});