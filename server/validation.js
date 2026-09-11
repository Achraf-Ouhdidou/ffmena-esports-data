const { z } = require('zod');

const id = z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/);
const name = z.string().trim().min(1).max(100);
const stat = z.number().int().nonnegative().max(100000000);

const team = z.strictObject({
  'Team Name': name,
  'Kill': stat,
  'Total Score': stat,
  'Survival Score': stat,
  'Damage': stat,
  'BOOYAH!': stat,
  'Match Rank': z.number().int().min(1).max(10000)
});

const player = z.strictObject({
  'Player Name': name,
  'Team Name': name,
  'Kill': stat,
  'Damage': stat,
  'Assist': stat,
  'Knock Down': stat,
  'Headshots': stat
});

const schemas = {
  credentials: z.strictObject({ email: z.string().email().max(254), password: z.string().min(1).max(256) }),
  tournament: z.strictObject({
    name,
    logo: z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).nullable().default(null)
  }),
  logo: z.strictObject({
    logo: z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  }),
  namedEntity: z.strictObject({ name }),
  match: z.strictObject({
    tournamentId: id,
    phaseId: id,
    dayId: id,
    tournamentName: name.optional(),
    phaseName: name.optional(),
    dayName: name.optional(),
    teams: z.array(team).max(5000).default([]),
    players: z.array(player).max(5000).default([])
  }).refine(value => value.teams.length > 0 || value.players.length > 0, {
    message: 'At least one team or player row is required.'
  }),
  filters: z.object({ tournamentId: id.optional(), phaseId: id.optional(), dayId: id.optional() })
};

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues.map(issue => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; ');
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  throw error;
}

module.exports = { schemas, parse };