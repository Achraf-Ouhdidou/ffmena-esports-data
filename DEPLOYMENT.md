# Production Deployment and Dev-Team Handoff

## Final hosting split

- `strakhovgg.com`: public static frontend, hosted by the website owner on
  GitHub Pages.
- `admin.strakhovgg.com`: admin dashboard and REST API, hosted by the dev team.
- Firebase is not used.
- The dev team must provide one Linux server or managed container service with
  persistent disk, DNS, TLS, and backups.

## What the dev team receives

The GitHub repository contains the public frontend, admin frontend, backend,
tests, Docker image definition, Compose file, environment template, API
contract, and operations utilities. No secret or production data is committed.

## Required infrastructure

- Linux x86-64 or ARM64 server
- Docker Engine with Compose v2, or Node.js 24+
- Persistent disk with at least 1 GB available
- HTTPS reverse proxy/load balancer
- DNS control for `admin.strakhovgg.com`
- Daily off-server backup destination

SQLite requires a single running application replica. Do not deploy multiple
replicas against the same SQLite file.

## DNS and TLS

The dev team provides the server IP or managed-host CNAME target. The domain
owner creates one of these records:

```text
A      admin    <SERVER_IPV4>
AAAA   admin    <SERVER_IPV6>       # only when IPv6 is configured
```

or:

```text
CNAME  admin    <PROVIDER_TARGET>
```

Issue a trusted TLS certificate for `admin.strakhovgg.com`, force HTTPS, and
proxy traffic to `http://127.0.0.1:3000`. Pass `X-Forwarded-Proto` and
`X-Forwarded-For` headers. A minimal Caddy configuration is:

```caddyfile
admin.strakhovgg.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

## First server deployment with Docker

```bash
git clone https://github.com/Achraf-Ouhdidou/ffmena-esports-data.git
cd ffmena-esports-data
cp .env.example .env
npm ci
npm run hash-password
```

Put the generated bcrypt hash in `ADMIN_PASSWORD_HASH`. Set a unique admin
email and generate a session secret, for example:

```bash
openssl rand -base64 48
```

Keep the bcrypt value single-quoted in `.env` so Compose treats `$` literally.
Then start the service:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3000/healthz
```

The required production variables are documented in `.env.example`:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Must be `production` |
| `HOST` / `PORT` | Internal listener; defaults to `0.0.0.0:3000` |
| `DATABASE_PATH` | Persistent SQLite path; default works with Compose volume |
| `ADMIN_EMAIL` | Only authorized admin identity |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash, never plaintext |
| `SESSION_SECRET` | Random 32+ character key used to hash sessions |
| `SESSION_TTL_HOURS` | Admin session lifetime |
| `ALLOWED_ORIGINS` | Exact public and admin HTTPS origins |
| `TRUST_PROXY` | Set to number of trusted reverse proxies, normally `1` |

Tournament logo files are limited to 500 KB in the admin browser. Base64
encoding adds roughly one third, so the API accepts data URLs up to 700 KB.

## Deployment without Docker

```bash
npm ci --omit=dev
NODE_ENV=production node server/index.js
```

Run it as a dedicated unprivileged service account under systemd or the host's
process manager. Persist `data/` and keep the Node port inaccessible from the
public internet; expose only ports 80/443 through the reverse proxy.

## Public frontend release

GitHub Pages serves `master` at `https://strakhovgg.com`. The checked-in
`js/runtime-config.js` points public reads to:

```text
https://admin.strakhovgg.com/api/v1
```

If the dev team chooses another API hostname, update that file and the
`connect-src` policy in `index.html`, then update `ALLOWED_ORIGINS` on the
server. Keep `CNAME` unchanged.

## Backups and restore

Create an online-consistent SQLite backup:

```bash
docker compose exec app node scripts/backup.js /app/backups/ffmena-$(date +%F-%H%M).sqlite
```

Copy backups to storage outside the server every day. Retain at least 7 daily
and 4 weekly copies. Test restoration quarterly.

Restore procedure:

1. Stop the app: `docker compose stop app`.
2. Preserve the current database.
3. Copy the chosen backup to the persistent volume as `ffmena.sqlite`.
4. Start the app and verify `/healthz`, login, and public leaderboard data.

## Release procedure

```bash
git pull --ff-only
npm ci
npm test
docker compose build --pull
docker compose up -d
curl --fail https://admin.strakhovgg.com/healthz
```

Acceptance checks:

1. `https://admin.strakhovgg.com/` opens the login page over HTTPS.
2. Create a tournament, phase, and day.
3. Upload both sample CSVs and confirm the match appears.
4. `https://strakhovgg.com` displays the tournament and both leaderboards.
5. Export matches and tournaments from the admin panel.
6. Delete test records and confirm cascade deletion.
7. Verify phone and desktop layouts and check the browser console.
8. Run a backup and copy it off-server.

## Monitoring and rollback

Monitor `/healthz`, HTTP 5xx rate, disk usage, container restarts, TLS expiry,
and backup completion. Application logs are structured JSON and include an
`x-request-id` response header.

To roll back code, check out the prior tested Git commit and rebuild the
container. Schema creation is additive in version 1.0. Back up the database
before every deployment and restore it only when data rollback is required.
