# Finance-Lab-Website

## Backend (`backend/`)

Node/Express API for visit-request submissions, email notifications (via Outlook/M365
SMTP), and a minimal admin dashboard API.

- `src/server.js` — Express app entrypoint. Routes: `GET /api/health`,
  `/api/visit-requests`, `/api/admin`.
- `src/db.js` — SQLite (better-sqlite3) storage for visit requests, at `DB_PATH`.
- `src/mailer.js` — sends a notification email (via nodemailer) to `NOTIFY_TO` whenever
  a visit request comes in. Uses Outlook/M365 SMTP (`smtp.office365.com:587`, STARTTLS).
  Email failures are logged but don't fail the request — the submission is already
  stored in the DB either way.
- `src/auth.js` — single admin account (username/password from env vars, password
  stored as a scrypt hash) with a stateless, HMAC-signed session cookie (no session
  table). 12-hour session lifetime.
- `src/routes/visits.js` — `POST /api/visit-requests` (public, validates name/email),
  `GET /api/visit-requests` (admin-only, list all), `PATCH /api/visit-requests/:id`
  (admin-only, update `status`).
- `src/routes/admin.js` — `POST /api/admin/login`, `POST /api/admin/logout`,
  `GET /api/admin/me`.

### Environment variables

Copy `backend/.env.example` to `backend/.env` for local dev (loaded automatically via
`dotenv`); in Docker/production pass them as `-e` flags or an env file to `docker run`.

| Var | Purpose |
|---|---|
| `PORT` | Port to listen on (default 3000) |
| `DB_PATH` | SQLite file path |
| `SMTP_HOST` / `SMTP_PORT` | Outlook/M365 SMTP host+port (`smtp.office365.com` / `587`) |
| `SMTP_USER` / `SMTP_PASS` | Mailbox address + app password used to authenticate |
| `SMTP_FROM` | From address (usually same as `SMTP_USER`) |
| `NOTIFY_TO` | Where visit-request notifications are sent (comma-separate for multiple recipients) |
| `ADMIN_USERNAME` | Admin dashboard login username |
| `ADMIN_PASSWORD_HASH` | Generate with `npm run hash-password -- "your-password"` |
| `SESSION_SECRET` | Random secret for signing session cookies, e.g. `openssl rand -hex 32` |

Outlook/M365 SMTP requires SMTP AUTH enabled on the mailbox and, for accounts with MFA,
an app password (regular password won't work) — set this up in the Microsoft 365 admin
center / account security settings before deploying.

### Admin access

There's a small admin page at **`/admin.html`** (served by nginx alongside the main
site, e.g. `https://yourdomain/admin.html`):

- On load it calls `GET /api/admin/me`; if not logged in, shows a username/password
  form which posts to `/api/admin/login`.
- On success it sets the signed session cookie (`admin_session`, 12h lifetime) and
  loads the visit-requests table from `GET /api/visit-requests`.
- Each row has a status dropdown (`new` / `contacted` / `confirmed` / `completed` /
  `declined`) that calls `PATCH /api/visit-requests/:id` on change.
- "Log out" clears the session via `POST /api/admin/logout`.

Log in with the `ADMIN_USERNAME` you set and the plaintext password whose hash you put
in `ADMIN_PASSWORD_HASH`. There's no "forgot password" flow — to change the password,
regenerate the hash (`npm run hash-password -- "new-password"`) and update the secret.

If you'd rather not have `/admin.html` publicly reachable at all, restrict it in
`nginx.conf` (e.g. IP allowlist or basic auth in front of it) — right now anyone can
load the page, they just can't do anything without valid credentials.

### Running locally

```
cd backend
npm install
npm run hash-password -- "your-password"   # paste result into ADMIN_PASSWORD_HASH
npm start
```

### Deployment

- The frontend (`nginx`, root `Dockerfile`) proxies `/api/` to a `financelab-api`
  container on the shared `app_default` docker network (see `nginx.conf`).
- `.github/workflows/deploy.yml` builds and runs both containers on push to `main`.
  The backend container reads its config from GitHub Actions secrets: `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `NOTIFY_TO`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` — these must be added in the repo's Settings →
  Secrets before the workflow can deploy a working backend.
- SQLite data persists in a `financelab-api-data` docker volume.

## Recent changes

**2026-07-22**
- Added **`admin.html`** — the actual admin dashboard page (login form + visit-requests
  table with status updates). See "Admin access" above. Wired into the root
  `Dockerfile` so nginx serves it.
- `NOTIFY_TO` confirmed to support a comma-separated list of recipients (nodemailer
  parses it natively — no code change needed), noted in `.env.example` and above.
- GitHub Actions secrets (`SMTP_*`, `NOTIFY_TO`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`,
  `SESSION_SECRET`) have been added to the repo by the maintainer — deploy should now
  produce a fully working backend. `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` values
  were generated in-chat and are not stored anywhere in this repo; regenerate via
  `npm run hash-password -- "..."` / `openssl rand -hex 32` if they ever need rotating.
- **Fixed absolute `/api/...` paths breaking both `admin.html` login and the
  `index.html` visit-request form.** The test deployment serves these pages under a
  subpath (`https://financelab.iba.edu.pk/testing/...`), but both pages called
  `fetch('/api/...')` — a leading `/` resolves against the domain root in the browser,
  not the page's own subpath. That sent every request to
  `https://financelab.iba.edu.pk/api/...` (a 404 against an unrelated app) instead of
  `https://financelab.iba.edu.pk/testing/api/...` (the actual test backend), which
  surfaced as "Invalid username or password" on admin login and "Something went wrong
  sending your request" on the visit form regardless of correct input. Fixed by making
  both endpoints relative (`fetch('api/...')` in `admin.html`,
  `VISIT_REQUEST_ENDPOINT = 'api/visit-requests'` in `index.html`), so they resolve
  correctly whether the site is served from the domain root or a subpath.

**2026-07-21**
- **`index.html`** — visit-request form now submits to the backend
  (`POST /api/visit-requests`) instead of Formspree. Disabled/"Submitting…" state on
  the submit button and an inline error (`#err-submit`) shown on failure.
- **`backend/`** — built out from an empty scaffold into a working API: SQLite storage,
  Outlook/M365 SMTP email notifications, admin login + visit-request listing, Docker
  deploy wired into `nginx.conf` and `.github/workflows/deploy.yml`. See "Backend"
  section above for details.
