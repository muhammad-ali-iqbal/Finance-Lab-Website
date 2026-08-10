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

**2026-08-10 (later)**
- **Added LaTeX math support to blog post bodies.** `## `/`- ` heading/bullet
  markers were also made tolerant of missing spaces and missing line breaks
  (e.g. `##Heading` glued mid-paragraph, `-Item` with no space) — previously
  these rendered as literal `##`/`-` text instead of real headings/lists.
  - `backend/src/blogTemplate.js` — new `renderInline()` helper: text is
    scanned for `\(...\)` (inline) and `\[...\]` (display) math and rendered
    server-side via the new `katex` dependency (`katex.renderToString(...,
    { throwOnError: false, output: 'html' })`) **once, at save time** — the
    resulting HTML is baked into the static `.html` file, no client JS or
    CDN script needed to display math. `$...$` was deliberately NOT used as
    a math delimiter (this is a finance blog — `$100`, `$50 cost` etc. need
    to stay literal). A malformed expression degrades to a small red
    error note (KaTeX's built-in behavior) instead of failing the save.
  - KaTeX's stylesheet is pulled from a CDN (`cdn.jsdelivr.net`) in the blog
    page `<head>`, same pattern already used for Google Fonts — needed
    because the rendered math HTML relies on KaTeX's CSS/font files for
    correct layout, even though the HTML itself is pre-rendered.
  - `admin.html` — updated the Body field's hint/placeholder to document the
    math syntax.
  - Existing posts saved before this change keep their old rendered HTML on
    disk; re-saving a post (no content change needed) re-renders it with
    the fixed heading/bullet parsing and enables math in it.

**2026-08-10**
- **Fixed: deleting a blog post via the CMS broke every image on the live site.**
  Root cause was two independent bugs that compounded:
  1. The homepage's "What the Lab Offers" cards were hardcoded `<a href="blog/<slug>">`
     links in `index.html`, disconnected from the CMS. Deleting a post left a dangling
     link with no way to remove it except a manual `index.html` edit.
  2. `nginx.conf`'s catch-all `location / { try_files ... /index.html; }` also matched
     `/blog/<deleted-slug>`: since the rendered file no longer exists, nginx silently
     served `index.html`'s content via an internal rewrite (not a redirect), so the
     browser's URL stayed at `/blog/<slug>`. Every relative path on that page
     (`assets/images/...`, and the offer cards' own `blog/...` links) then resolved
     one level too deep, breaking every image — and repeatedly clicking an offer card
     kept stacking another `blog/` onto the URL (`/blog/blog/blog/...`).
  Fixes:
  - `nginx.conf` — added a dedicated `location /blog/ { try_files $uri $uri.html =404; }`
    so a missing/deleted slug now 404s honestly instead of falling through to the
    homepage under the wrong path.
  - `backend/src/routes/blog.js` — `GET /api/blog-posts` (slug/title/teaser) is now
    **public** (moved above `router.use(requireAdmin)`); `GET /:slug`, `PUT`, `DELETE`
    remain admin-only.
  - `index.html` — the 3 hardcoded offer cards are gone; `#offers-grid` is now
    populated at load from `fetch('api/blog-posts')`, same pattern as the Events
    section. Adding or deleting a post now automatically adds/removes its homepage
    card — no more manual `index.html` edits, and no more dangling links.

**2026-07-23 (even later)**
- **Added a dedicated "Facilities" CMS tab**, bundling the Facilities page's photos
  and text together in one place instead of scattering them across "Homepage" and
  "Homepage Text":
  - `backend/src/db.js` — `SITE_IMAGE_KEYS` restored to all 9 slots (Terminal +
    4 Facility photos are back, on top of Hero/Partner).
  - `index.html` — restored `data-image-key` on `.terminal-img`/`.resource-img`.
  - `admin.html` — split `SITE_IMAGE_SLOTS` into `HOMEPAGE_IMAGE_SLOTS` (Hero+Partner,
    stays under "Homepage") and `FACILITIES_IMAGE_SLOTS` (Terminal+Facility, moves to
    the new tab); split `TEXT_FIELDS` into `HOMEPAGE_TEXT_FIELDS` (30 keys) and
    `FACILITIES_TEXT_FIELDS` (24 keys) the same way. To avoid duplicating the
    image-editor and text-editor JS logic across two tabs, both are now built by
    factory functions (`setupImageEditor(opts)`, `setupTextEditor(opts)`) instantiated
    once per tab against their own DOM ids — same behavior as before, no more
    copy-pasted logic.

**2026-07-23 (later)**
- **Trimmed the "Homepage" image tab down to Hero Carousel + Partner Photo only** —
  `SITE_IMAGE_KEYS` in `backend/src/db.js` dropped from 9 slots to 4
  (`hero-1/2/3`, `partner`); Terminal Photo and the 4 Facility Photos are plain
  non-editable placeholder boxes again, matching their appearance before that feature
  shipped. (Any `terminal`/`facility-*` rows already in a deployed `site_images` table
  are simply unused now — no migration needed, nothing references those keys anymore.)
- **Added a "Homepage Text" tab** covering ~54 headings/paragraphs across the whole
  `index.html` single-page app (Home, Facilities, Events page-hero, Contact page-hero,
  footer brand blurb). Deliberately excluded: nav labels, form field labels, raw
  contact details, the footer legal line, and the 3 offer-card blurbs (already a
  documented drift risk with the blog CMS — a third edit location would make it worse,
  not better).
  - `backend/src/db.js` — new `site_text` key-value table, seeded once from the
    current hardcoded copy (`SEED_SITE_TEXT`).
  - `backend/src/routes/site-text.js` — `GET` public; `PUT` (admin-only) takes a
    `{ values: { key: value } }` bulk payload, validates every key against a whitelist,
    upserts all in one `db.transaction(...)`.
  - `index.html` — every target element got a `data-text-key="..."` attribute; a
    `fetch('api/site-text')` on load sets `textContent` from the API response (plain
    text, no HTML injection risk).
  - `admin.html` — new "Homepage Text" tab: unlike the per-row "click Edit" pattern
    used for images/events, this is one long form (grouped under section headings,
    generated from a `TEXT_FIELDS` catalog) with a single "Save all changes" button —
    a bulk edit fits plain text much better than 54 individual dialogs would.
- Also answered (no code change): whether to move to a WordPress-style CMS instead of
  continuing to extend this custom one. Recommendation was to stay custom given the
  site's size — a WordPress migration means a full stack/hosting swap in exchange for
  broad ad-hoc page-building flexibility this site doesn't currently need.

**2026-07-23**
- **Added a "Homepage" tab to the CMS** for the 9 fixed image slots baked into
  `index.html`: the 3 hero carousel photos, the partner/MOU photo, the Bloomberg
  Terminal photo, and the 4 facility photos. Unlike blog posts/events (repeatable
  rows), these are fixed named slots, so the design is a key-value table rather than a
  list:
  - `backend/src/db.js` — new `site_images` table (`key` primary key), seeded once
    with all 9 slots; the 3 hero slots seed pointing at the existing
    `assets/images/car-1/2/3.jpg` (so the API always has something to return), the
    other 6 seed with no image (placeholder stays exactly as before).
  - `backend/src/routes/site-images.js` — `GET /api/events`-style public listing;
    `PUT`/`DELETE /api/site-images/:key` (admin-only) validate the key against a fixed
    whitelist and reuse the same multer upload pattern as events. `DELETE` reverts a
    slot to null (hero slots fall back to their bundled photo since `index.html` only
    overrides `src` when the API returns a non-null path; the other 6 fall back to the
    placeholder box).
  - New shared volume `financelab-site-images`, same live-update-without-redeploy
    mechanism as blog/event content.
  - `index.html` — carousel `<img>` tags got stable `id`s (`hero-img-1/2/3`); the 6
    placeholder wrappers got `data-image-key` attributes. A `fetch('api/site-images')`
    on load fills in any slot that has a CMS image, leaving everything else untouched.
  - `admin.html` — new "Homepage" tab lists all 9 slots grouped under headings, each
    with the same upload + position-slider editor built for events, generalized to
    operate on a fixed slot key instead of a row id.
  - **Also fixed `.resource-img`** (facility photo boxes) — same missing
    `overflow:hidden` bug as `.event-img` had (`.resource-card` is a flex column), just
    never triggered yet since no facility photo existed before this feature.
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
