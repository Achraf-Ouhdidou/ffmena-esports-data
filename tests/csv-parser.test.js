const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

async function loadParser() {
  const context = { Papa: require('papaparse') };
  vm.createContext(context);
  vm.runInContext(
    `${fs.readFileSync(path.join(root, 'js', 'csv-parser.js'), 'utf8')};globalThis.parser=CSVParser`,
    context
  );
  return context.parser;
}

async function run() {
  const parser = await loadParser();
  const playerFile = fs.readdirSync(root).find(name => name.startsWith('player'));
  const teams = parser.parse(fs.readFileSync(path.join(root, 'teams_data_example.csv'), 'utf8'), 'team');
  const players = parser.parse(fs.readFileSync(path.join(root, playerFile), 'utf8'), 'player');

  assert.equal(teams.length, 12);
  assert.ok(players.length > 0);
  assert.throws(
    () => parser.parse('Team Name,Kill\nTest,abc', 'team'),
    /Missing columns/
  );
  assert.throws(
    () => parser.parse('Team Name,Kill,Total Score,Survival Score,Damage,BOOYAH!,Match Rank\nTest,nope,1,1,1,0,1', 'team'),
    /Kill must be a non-negative whole number/
  );

  console.log(`CSV validation OK: ${teams.length} teams, ${players.length} players`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});