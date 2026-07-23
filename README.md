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

**2026-07-23**
- **Added an "Events & News" tab to the CMS** (`admin.html`), for the homepage's
  "Events & News" section — create/edit/delete events with a category, date label,
  title, excerpt, and an optional photo upload. This was a bigger change than the blog
  CMS because event data previously lived as a hardcoded JS array baked directly into
  `index.html` (no separate pages), and there was no image support anywhere for events
  (just a placeholder "Event photo" box) — both needed new plumbing:
  - `backend/src/routes/events.js` — `GET /api/events` is **public** (unauthenticated),
    since this is public homepage content; `POST`/`PUT`/`DELETE` require admin. Image
    uploads handled via `multer` (new dependency, using 2.x — 1.x has known
    vulnerabilities), disk storage into `EVENT_IMAGES_DIR`, filenames generated
    server-side (never trusting the client's original filename), restricted to
    jpeg/png/webp/gif, 5MB limit.
  - `backend/src/db.js` — new `events` table, seeded once from the 6 events that used
    to be hardcoded in `index.html` (no images, matching prior behavior — no regression).
  - **Deploy:** new shared Docker volume `financelab-event-images`, writable by
    `financelab-api`, mounted read-only into `financelab-test` (nginx) at
    `/usr/share/nginx/html/assets/images/events` — same live-update-without-redeploy
    mechanism as the blog CMS's `financelab-blog-content` volume.
  - `index.html` — the hardcoded `events` array is gone; the homepage now fetches
    `api/events` at load and renders from that. Category filter buttons/colors
    (previously two more hardcoded lists) are now derived dynamically from whatever
    categories exist in the data, so a brand-new category typed into the CMS "just
    works" with a distinct color — no code edit needed. Added an `escapeHtml` helper
    since event content is no longer hardcoded trusted strings.
  - `admin.html`'s shared `api()` helper now skips setting `Content-Type` when the
    request body is `FormData` (needed for the image upload — the browser sets the
    correct multipart boundary itself).
- Also noticed `backend/blog-content/` (from yesterday's blog CMS) was missing from
  `.gitignore` — added it, alongside the new `backend/event-images/`.
- **Fixed uploaded event photos changing the card's box shape/size.** `.event-card` is
  a flex column, and `.event-img` (a flex item) had no `overflow` set, so its automatic
  minimum height was based on the full uploaded image's natural size, overriding the
  intended `aspect-ratio:16/10` box. Added `overflow:hidden` to `.event-img` — the box
  now stays fixed and crops the photo to fit, regardless of the source image's shape.
- **Added image repositioning** — events now have `image_pos_x`/`image_pos_y` (0–100,
  default 50/50) controlling `object-position` on the rendered photo, so a cropped
  photo can be re-centered on its subject. Migrated in via `ALTER TABLE` in `db.js`
  (guarded by checking `PRAGMA table_info`) since the `events` table already has live
  data on the VPS. The admin form gets two range sliders (horizontal/vertical) with a
  live 16:10 preview box matching the real card's crop; values are clamped 0–100
  server-side in `routes/events.js` regardless of what the client sends.

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
- **Fixed the 3 blog pages (`blog/*.html`) not deploying at all.** The root
  `Dockerfile` never copied the `blog/` folder into the nginx image, so
  `/testing/blog/<slug>.html` 404'd and nginx's SPA fallback
  (`try_files ... /index.html`) silently served the homepage instead — with broken
  styling, since its relative asset paths resolved against `/testing/blog/` instead of
  `/testing/`. Fixed by adding `COPY blog /usr/share/nginx/html/blog` — later superseded
  by the CMS volume mount (see below).
- **Clean URLs for blog posts, no `.html` exposed.** `nginx.conf`'s `try_files` now
  checks `$uri.html`, so `/blog/<slug>` serves `blog/<slug>.html` without the extension
  showing; a redirect rule sends any direct `.html` hit to the clean URL. Updated the
  homepage's "What the Lab Offers" card links and each blog page's logo/back-link/CTA
  links (previously `../index.html#...`) to use clean URLs (`../`, `../#offers-section`,
  `../#contact`) so navigating from a blog post back to the homepage doesn't reintroduce
  `index.html` into the address bar.
- **Added a lightweight blog CMS**, reusing the existing `admin.html` login (no new
  auth system, no GitHub OAuth) — decided against Decap CMS after considering it,
  since it would've required a separate GitHub-OAuth login and a CI build step for what
  is currently 3 simple posts:
  - `backend/src/blogTemplate.js` — renders the shared blog-page shell (extracted from
    the 3 existing pages) from structured fields (title, teaser, body, CTA text), with
    a small paragraph/`## heading`/`- bullet` markdown-like convention for the body.
  - `backend/src/db.js` — new `blog_posts` SQLite table, seeded once from the 3
    existing posts' content (verified the rendered output matches the original
    hand-written HTML exactly).
  - `backend/src/routes/blog.js` — `GET/PUT/DELETE /api/blog-posts[/:slug]`, behind the
    same `requireAdmin` session-cookie middleware used by visit-requests. Slugs are
    validated (`^[a-z0-9-]+$`) to block path traversal.
  - `admin.html` — new "Blog Posts" tab alongside "Visit Requests" (same login), with
    list/create/edit/delete for posts.
  - **Deploy change:** blog HTML is no longer baked into the nginx image. A new shared
    Docker volume (`financelab-blog-content`) is writable by `financelab-api` and
    mounted read-only into `financelab-test` (nginx) at `/usr/share/nginx/html/blog` —
    so saving a post via the CMS updates the live site instantly, no redeploy needed.
  - Known limitation: the homepage's 3 offer cards (`index.html`) are still manually
    maintained and not generated from the CMS content — editing a post's teaser via the
    CMS won't update the homepage blurb, and a new post needs a manual link added to
    `index.html`.

**2026-07-21**
- **`index.html`** — visit-request form now submits to the backend
  (`POST /api/visit-requests`) instead of Formspree. Disabled/"Submitting…" state on
  the submit button and an inline error (`#err-submit`) shown on failure.
- **`backend/`** — built out from an empty scaffold into a working API: SQLite storage,
  Outlook/M365 SMTP email notifications, admin login + visit-request listing, Docker
  deploy wired into `nginx.conf` and `.github/workflows/deploy.yml`. See "Backend"
  section above for details.
