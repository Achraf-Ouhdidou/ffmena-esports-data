# REST API Contract

Base URL: `https://admin.strakhovgg.com/api/v1`. Therefore the `/health`
endpoint below resolves to `https://admin.strakhovgg.com/api/v1/health`. The
container probe is also available at `https://admin.strakhovgg.com/healthz`.

All responses are JSON except successful `DELETE` and logout responses, which
return `204 No Content`. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation"
  }
}
```

## Public endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/health` | `{ "status": "ok", "version": "1.0.0" }` |
| `GET` | `/public/tournaments` | Tournament array |
| `GET` | `/public/tournaments/:id/phases` | Phase array |
| `GET` | `/public/tournaments/:id/phases/:phaseId/days` | Day array |
| `GET` | `/public/matches?tournamentId=&phaseId=&dayId=` | Match array |

## Authentication endpoints

| Method | Path | Body/response |
| --- | --- | --- |
| `POST` | `/auth/login` | Body `{ "email", "password" }`; returns `{ "user": { "email" } }` and session cookie |
| `GET` | `/auth/session` | Returns `{ "user": null }` or the active user |
| `POST` | `/auth/logout` | Revokes session and clears cookie |

## Admin endpoints

All paths require the session cookie.

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/admin/tournaments` | `{ "name", "logo": null | "data:image/..." }` |
| `PUT` | `/admin/tournaments/:id/logo` | `{ "logo": "data:image/..." }` |
| `DELETE` | `/admin/tournaments/:id` | None; cascades phases, days, and matches |
| `POST` | `/admin/tournaments/:id/phases` | `{ "name" }` |
| `DELETE` | `/admin/tournaments/:id/phases/:phaseId` | None; cascades days and matches |
| `POST` | `/admin/tournaments/:id/phases/:phaseId/days` | `{ "name" }` |
| `DELETE` | `/admin/tournaments/:id/phases/:phaseId/days/:dayId` | None; cascades matches |
| `POST` | `/admin/matches` | Match payload below |
| `DELETE` | `/admin/matches/:id` | None |

Match payload:

```json
{
  "tournamentId": "uuid",
  "phaseId": "uuid",
  "dayId": "uuid",
  "tournamentName": "optional display value; server ignores it",
  "phaseName": "optional display value; server ignores it",
  "dayName": "optional display value; server ignores it",
  "teams": [
    {
      "Team Name": "Atlas",
      "Kill": 11,
      "Total Score": 23,
      "Survival Score": 12,
      "Damage": 6494,
      "BOOYAH!": 1,
      "Match Rank": 1
    }
  ],
  "players": [
    {
      "Player Name": "Player One",
      "Team Name": "Atlas",
      "Kill": 5,
      "Damage": 2079,
      "Assist": 2,
      "Knock Down": 5,
      "Headshots": 2
    }
  ]
}
```

## Status codes

| Code | Meaning |
| --- | --- |
| `200/201/204` | Success |
| `400` | Invalid input or relationship |
| `401` | Missing, invalid, or expired admin session |
| `403` | Request origin is not allowed |
| `404` | Resource does not exist |
| `409` | Duplicate tournament, phase, or day |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error; inspect logs by request ID |
