# FFMENA Esports Platform

Tournament statistics platform for the FFMENA community. The repository contains:

- A static public leaderboard for `https://strakhovgg.com`
- An authenticated admin dashboard for `https://admin.strakhovgg.com`
- A Node.js REST API with SQLite persistence
- CSV validation, container deployment, backups, and integration tests

Firebase is not used.

## Architecture

```text
Visitors -> strakhovgg.com (GitHub Pages) -> public REST endpoints
Admins   -> admin.strakhovgg.com (Node server) -> authenticated REST endpoints
Node API -> SQLite file in persistent server storage
```

The browser validates uploaded CSVs and sends only normalized tournament rows to
the API. The server validates the payload again before saving it. Raw CSV files
are not retained. Tournament logos are limited to 500 KB before browser-side
Base64 encoding; the API allows up to 700 KB for the resulting data URL.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/API.md](docs/API.md), and [DEPLOYMENT.md](DEPLOYMENT.md).

## Requirements

- Node.js 24 or later
- npm 11 or later
- A persistent filesystem for `data/`
- HTTPS reverse proxy in production

## Local development

```powershell
npm ci
npm run hash-password
Copy-Item .env.example .env
# Put the generated hash and a random 32+ character session secret in .env
npm start
```

Open `http://localhost:3000/`. The same process serves the admin dashboard and
API. To point the public static site at a different API origin, edit
`js/runtime-config.js`.

## Quality checks

```powershell
npm test
npm audit --omit=dev
Get-ChildItem server\*.js,js\*.js,scripts\*.js | ForEach-Object { node --check $_.FullName }
```

## Repository map

```text
admin.html                 Admin dashboard
index.html                 Public leaderboard
css/                       Shared styles
js/api-client.js           REST and session client
js/data.js                 Data access and leaderboard aggregation
js/admin.js                Admin UI workflow
js/public.js               Public UI workflow
js/csv-parser.js           Browser CSV validation
js/runtime-config.js       Public API origin
server/                    Node API, auth, validation, SQLite
scripts/                   Password and backup utilities
tests/                     Unit and integration tests
data/                      Runtime database, ignored by Git
backups/                   Database backups, ignored by Git
```

## Security boundary

The public endpoints are read-only. Every mutation requires an HttpOnly,
Secure, SameSite session cookie. The server enforces schema validation, CORS,
rate limits, body limits, security headers, and relational integrity. Never
commit `.env`, the SQLite database, backups, or plaintext passwords.
