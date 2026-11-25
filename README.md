# CPHub

CPHub is a university-exclusive competitive-programming community for DSU
students. The React application uses Supabase Auth for email OTP
authentication, and a FastAPI backend for student profiles, cached LeetCode
statistics, and leaderboard data stored in Supabase PostgreSQL.

## Architecture

```text
src/                              React 19 + Vite application
  pages/                          Home, login, leaderboard, profiles, resources
  context/AuthContext.jsx         Supabase session restoration and auth events
  services/authService.js         OTP, session, and logout
  services/api.js                 Shared FastAPI requests and bearer token
  services/profileApi.js          Profile, branch, and LeetCode API
  services/leaderboardApi.js      Leaderboard API
supabase/migrations/              Database migrations 001–012

backend/                          FastAPI application
  app/routes/                     Health, profile, LeetCode, leaderboard, branches
  app/services/                   Supabase and LeetCode business logic
  app/schemas/                    Pydantic validation and API responses
  tests/                          Backend unit and route tests
```

Supabase Auth owns account creation, email verification, and sessions. The
browser sends the current access token to FastAPI for protected
requests. FastAPI validates it with Supabase Auth and derives the profile
owner from that validated identity. Public profile and leaderboard data are
returned through explicitly projected database functions; direct table reads
are owner-restricted by RLS. LeetCode statistics are fetched and cached by the
backend, not by React.

The repository root is the canonical frontend project: `src/`, `index.html`,
`vite.config.js`, and `package.json` are built together from the root. The
`Frontend/` submodule pointer on the recovery branch is not the deployed app
source. The root package scripts run the frontend test suite, lint, and build.

## Requirements and dependencies

- Node.js 20.19+ or 22.12+ and npm (Vite 8 requirement).
- Python 3.10 or later.
- A Supabase project with Auth, PostgreSQL, and the migrations below applied.
- A valid LeetCode username is collected at registration; public profile
  statistics are loaded from LeetCode when available.

Frontend dependencies are declared in the root `package.json`: React, React
DOM, Supabase JS, Vite, and ESLint. Backend dependencies are declared in
`backend/requirements.txt`:

- FastAPI and Uvicorn for the HTTP API.
- Pydantic and pydantic-settings for validation and environment configuration.
- Supabase Python SDK for Auth and database operations.
- HTTPX for the server-side LeetCode request.
- python-dotenv for local environment files.

## Frontend setup

```bash
npm install
cp .env.example .env.local
```

Set the frontend values in the repository-root `.env.local` file (Vite loads
the shared environment file from the repository root):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
VITE_API_BASE_URL=http://localhost:8000
```

`VITE_*` values are shipped to the browser. The Supabase publishable key and
FastAPI URL are public configuration; never put a service-role key, SMTP
credential, database password, or other privileged secret in a Vite variable.

Run the application:

```bash
npm run dev
```

The local Vite origin is normally `http://localhost:5173`. To validate frontend
changes:

```bash
npm test
npm run lint
npm run build
```

## Backend setup

From the repository root:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

On systems where the command is `python3`, use `python3 -m venv venv`.
Configure `backend/.env`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://<vercel-domain>
LEETCODE_CACHE_TTL=21600
```

Keep the service-role key only in the backend's private environment. Do not
commit `backend/.env` or expose its value to the frontend. `FRONTEND_ORIGINS`
is a comma-separated allowlist of exact browser origins. `LEETCODE_CACHE_TTL`
is in seconds; the default is six hours.

Start FastAPI from `backend/`:

```bash
uvicorn app.main:app --reload
```

- Health: <http://localhost:8000/health>
- Swagger UI: <http://localhost:8000/docs>
- OpenAPI JSON: <http://localhost:8000/openapi.json>

The health endpoint and Swagger UI do not require Supabase credentials. Data
and protected endpoints require the backend environment and database setup.

## Supabase configuration

1. Configure the Supabase **Magic Link** email template to display the numeric
   token using `{{ .Token }}`. Registration and returning sign-in use
   Supabase email OTP (`type: email`). Legacy password login and recovery
   remain available to existing accounts.
2. Keep Supabase email signup enabled for first-time registration and configure
   the project's Auth rate limits. Returning sign-in explicitly disables
   account creation. The backend returns the same OTP-request response for
   known and unknown addresses to reduce account enumeration.
3. Keep the existing Brevo SMTP configuration in Supabase Auth. Verify its
   sender and delivery settings in the Supabase Dashboard; do not replace the
   provider or add SMTP credentials to this repository or React.
4. CPHub accepts verified student addresses ending only in `@dsu.edu.in`.
5. Preserve RLS. Do not disable RLS or add public table-wide read policies to
   make the API work. The public data functions are the intended projection
   boundary.

## Database migrations

Apply approved migrations in order in the Supabase SQL Editor (or with the
Supabase CLI after linking the intended project):

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Profiles, LeetCode cache, indexes, triggers, and owner policies. |
| `002_leetcode_provider.sql` | Server-side LeetCode refresh state and restricted refresh RPCs. |
| `003_user_profiles_api.sql` | Username and atomic profile creation/completion function. |
| `004_leetcode_stats_metadata.sql` | Optional rating/ranking fields and successful-refresh RPC. |
| `005_public_leaderboard.sql` | Database-backed leaderboard projection, filters, sorting, and pagination. |
| `006_secure_public_profile_access.sql` | Owner-only direct table reads and safe public profile/leaderboard RPC access. |
| `007_platform_architecture.sql` | Adds profile fields, normalized LeetCode/account/activity/topic/sync/preferences tables, RLS, and legacy-data backfills; live schema verified. |
| `008_passwordless_registration.sql` | Adds a service-role-only account-existence check and atomic registration completion, including the LeetCode link and initial stats row. |
| `009_leetcode_public_profile_cache.sql` | Adds the optional LeetCode public-profile cache and atomic stats/profile sync RPC. |
| `010_public_profile_analytics.sql` | Extends the public-profile RPC with privacy-filtered cached LeetCode activity and topic analytics. |
| `011_leaderboard_public_statistics.sql` | Extends the public leaderboard with approved identity/stat fields and adds a cached-total ordering index. |
| `012_security_hardening.sql` | Restricts trigger-only function execution, pins trigger search paths, and optimizes owner RLS checks. |

### Migration 007 review and existing-data impact

`007_platform_architecture.sql` was reported as **successfully applied** in
the Supabase SQL Editor and its expected tables and columns were verified in
the live project on 2026-11-26. Do not run it again. It is a transaction-wrapped,
forward-only migration: it does not drop tables or columns, truncate tables,
or delete existing rows. Existing column names used by the current FastAPI
application remain available so the current code can continue using migrations
001–006 during a staged rollout.

The migration makes these changes:

- **`profiles`:** adds `full_name`, `university`, `avatar_url`, `bio`, and
  `is_public`. Existing `full_name` values are initialized from non-empty
  `display_name`; `university`, `avatar_url`, and `bio` remain `NULL` because
  no source values exist. Existing profiles with a claimed username are
  marked public to preserve current public-profile/leaderboard visibility;
  unclaimed profiles and future rows default to private. The current profile
  columns (`display_name`, `graduation_year`, and `leetcode_username`) and
  username uniqueness remain intact. A trigger keeps `full_name` and
  `display_name` synchronized when legacy or upgraded clients change one name
  field.
- **`leetcode_stats`:** adds a unique UUID `id` plus `total_solved`, `ranking`,
  `last_synced_at`, and `updated_at`. Existing values are copied from
  `solved_total`, `global_ranking`, and `fetched_at`. `user_id` remains the
  primary key to preserve the existing cache upsert contract; `id` is a unique
  surrogate key, not a replacement primary key. A trigger keeps both old and
  new column names synchronized.
- **New `leetcode_accounts`:** stores one LeetCode account row per Auth user.
  Valid existing profile handles are copied in normalized lowercase form;
  shared handles are retained because the existing schema did not forbid
  them. Clearing a profile handle marks its account row `unlinked` rather than
  deleting it. A sync finishing after a handle change does not relink the old
  handle.
- **New `user_activity`:** adds a unique `(user_id, activity_date)` record and
  backfills dates from the cached submission calendar using UTC. LeetCode's
  calendar counts submissions, so `problems_solved` in this backfill means
  submission count, not distinct problems solved. Later syncs safely upsert
  dates without deleting days omitted by a response.
- **New `topic_stats`:** adds a case-insensitive unique user/topic key and
  backfills available `solved_by_topic` JSON. Existing topic data is retained
  in `leetcode_stats`; null or unavailable topic data is not invented.
- **New `sync_logs`:** records a snapshot for existing fetch-state rows and
  then future completed sync attempts. Historical per-attempt detail cannot
  be reconstructed from the existing fetch-state table.
- **New `user_preferences`:** creates one empty JSON preference record per
  existing profile and initializes future users at signup. Preferences remain
  private.
- **Indexes, timestamps, RLS, and access:** adds lookup/leaderboard indexes
  and `updated_at` triggers. Owners can read their own private rows; only the
  owner can edit their profile and preferences. Statistics, linked accounts,
  activity, topics, and sync logs are not user-writable through PostgREST;
  server-side sync RPCs are restricted to `service_role`. Public profile and
  leaderboard RPCs emit explicit fields only for profiles marked public.

The profile and stats backfills scan existing rows and cached JSON, so runtime
depends on project size and may briefly hold table locks. The transaction
rolls back the complete migration if a statement fails.

### Migration 008 and authentication impact

Migration `008_passwordless_registration.sql` is not recorded in the live
migration ledger, but its RPC functions were verified in the schema on
2026-11-26. The migration is additive and
transaction-wrapped; it does not drop tables, delete rows, or alter existing
records. The live project contains both RPCs; do not apply this migration a
second time. It:

- Adds `auth_user_exists(email)`, a `SECURITY DEFINER` function executable only
  by `service_role`; the public OTP endpoint never returns its result.
- Adds the service-role-only `complete_registration` RPC. It atomically claims
  the authenticated user's unclaimed profile, saves required profile and
  LeetCode fields, and inserts a zeroed pending statistics row only when one
  does not already exist. Existing statistics are preserved.
- Keeps the existing Auth identity, LeetCode-account trigger, RLS policies,
  and Brevo SMTP configuration intact.

Migration files are in `supabase/migrations/`. For an existing project, apply
only migrations that are not already installed; do not rerun earlier
production migrations just because the checked-in source has changed. Live
checks confirmed migration 006's access model: RLS is enabled and anonymous
table reads of `profiles` and `leetcode_stats` are denied. Its version is not
recorded in the CLI migration ledger.

Migration `009_leetcode_public_profile_cache.sql` is not recorded in the live
migration ledger, but its statistics columns were verified in the schema on
2026-11-26. Do not apply it a second time. It is additive and
transaction-wrapped: it adds a nullable JSONB cache column and a service-role
RPC; it neither drops nor deletes existing data. The migration also clears
`last_synced_at` when a user's linked LeetCode username changes, so an old
account's sync time is not presented as current. On sync, optional cached
fields are preserved if LeetCode omits them for the same handle, but not
carried over to a newly linked handle.

Migration `010_public_profile_analytics.sql` is additive and replaces only the
public-profile RPC. It returns an explicit public projection, including the
cached activity calendar and topic counts, only when the profile owner has
enabled public visibility. It does not expose user IDs, university email,
LeetCode cache JSON, or private preferences. Apply it after migration 009 and
before deploying the public-profile endpoint changes. Its analytics fields
were verified in the live RPC definition on 2026-11-26.

Migration `011_leaderboard_public_statistics.sql` transactionally replaces
the public leaderboard RPC and adds a partial index for successful cached
total-solve ordering. It returns only public avatar/name/username/branch/year,
cached LeetCode solve counts, available global ranking, LeetCode link, and
statistics refresh time. It continues excluding private profiles and does not
expose email, Auth IDs, USNs, or preferences. The RPC joins the one-per-user
LeetCode statistics row, performs search/filter/sort/pagination in PostgreSQL,
and does not contact LeetCode. Apply it after 010 and before deploying this
leaderboard API/UI version. Its expected fields were verified in the live RPC
definition on 2026-11-26.

The live migration ledger currently lists only migrations 001–005, while
schema inspection confirms the expected objects from 006–011 are present.
Those later migrations appear to have been applied outside the CLI ledger.
Do not run `supabase db push` against production until the migration history
has been reconciled with the live schema. Migration 012 is new and has not
been applied.

Check the linked project's migration ledger from the repository root:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase migration list --linked
```

Do not run `supabase db push` against production until migrations 006–011 are
reconciled with the manually applied schema objects. Apply migration 012 only
after the ledger is corrected and the migration has been reviewed.

## API smoke tests

With FastAPI running and its environment configured:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/branches
curl 'http://localhost:8000/api/leaderboard?limit=20&offset=0'
curl http://localhost:8000/api/profile/<username>
```

Protected profile and LeetCode endpoints require a current Supabase access
token:

```bash
curl http://localhost:8000/api/profile/me \
  -H "Authorization: Bearer <supabase-access-token>"

curl -X POST http://localhost:8000/api/leetcode/refresh \
  -H "Authorization: Bearer <supabase-access-token>"
```

LeetCode cached endpoints are `GET /api/leetcode/profile`, `/stats`,
`/activity`, `/topics`, and `/account`. To explicitly refresh saved data, use
`POST /api/leetcode/sync`; update the authenticated user's connection with
`PUT /api/leetcode/account` and JSON `{"leetcode_username":"..."}`. Daily
activity is a LeetCode submission count, not a count of distinct solved
problems. Missing optional profile/topic data remains unavailable rather than
being fabricated.

Run backend tests from the repository root:

```bash
cd backend
python -m unittest discover -s tests -v
```

Automated tests use mocked Supabase and LeetCode responses; they do not send
real emails, call a production database, or verify a live LeetCode account.
They cover OTP service behavior, bearer-token validation, profile ownership
and privacy, LeetCode username/stat/cache/error behavior, and leaderboard
filters, sorting, pagination, and empty results.

## Authentication and application flows

- Registration and returning login request OTP through FastAPI. The server
  checks account existence privately, creates an Auth user only for a new
  registration, and always returns an enumeration-resistant response.
- After OTP verification, complete the profile once (name, unique username,
  university, branch, graduation year, and LeetCode username). The username is
  checked against LeetCode. Profile, LeetCode connection, and initial
  statistics are committed atomically.
- Returning users verify only an email OTP; their existing profile and saved
  LeetCode account are loaded without repeating onboarding.
- The frontend restores the Supabase session and listens for auth-state
  changes. An authenticated user without a completed profile is directed to
  `/my-profile`.
- OTP resend has a 60-second per-email UI cooldown; Supabase Auth's project
  rate limits remain the server-side enforcement.
- Students create or edit their own profile through FastAPI. Public profiles
  and the leaderboard omit university email, Auth IDs, and credentials.
- The LeetCode refresh endpoint derives its owner from the validated bearer
  token. Successful statistics are cached; failed refreshes preserve the last
  successful result.
- `/dashboard` is the protected personal dashboard and is the post-login and
  post-registration destination.
- Implemented application paths include `/`, `/home`, `/login`, `/signin`,
  `/leaderboard`, `/profile/:username`, `/my-profile`, `/dashboard`, and
  `/resources`. `/contests` and `/rankings` currently display placeholders.

## Production deployment

The deployment target has **not** been configured or verified from this
workspace. No production URLs, Supabase production settings, SMTP credentials,
or backend-host credentials are available here. Do not route production traffic
to a new build until the staged checks below pass.

### 1. Stage and verify before production

1. Select/prepare a staging Supabase project and a staging FastAPI service.
   Keep the existing production API, Supabase project, and Vercel production
   deployment unchanged during staging.
2. Verify the migration history in the intended project using
   `supabase migration list --linked` after linking the CLI to that project.
   Compare it with `supabase/migrations/001_initial_schema.sql` through
   `011_leaderboard_public_statistics.sql`; inspect existing state before
   running any SQL. Migrations 008–011 have not been verified as applied by
   this workspace. Migration 007 was previously reported as applied, but that
   report is not a live database verification.
3. Back up the staging database, then apply only reviewed, pending migrations
   in numeric order. Do not run a migration twice manually or apply production
   SQL until the owner has reviewed and approved it. Confirm RLS remains
   enabled and exercise anonymous/authenticated access after each schema batch.
4. Configure the staging backend and a Vercel Preview deployment using only
   staging endpoints and credentials. Use the same code/build configuration
   that will be promoted.
5. Run the end-to-end checklist below against staging with dedicated test
   accounts. Do not use personal or production student accounts.

### 2. Vercel frontend setup

The root `vercel.json` configures the Vite production build output, client-side
route fallback, and baseline browser security headers.

In Vercel, import the repository and set:

| Setting | Value |
|---|---|
| Root Directory | `.` (repository root) |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js | 22.x (Vite requires Node 20.19+ or 22.12+) |

Set these variables separately for Preview and Production deployments:

```text
VITE_SUPABASE_URL=https://<intended-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<that-project-publishable-or-anon-key>
VITE_API_BASE_URL=https://<public-fastapi-host>
```

`VITE_*` values are included in browser assets. Only the Supabase publishable
key, public Supabase URL, and public API origin belong here. Never place the
service-role key, SMTP credentials, database password, or other server secret
in Vercel frontend variables. Use Preview variables with staging resources.

Attach/verify the production custom domain only after staging passes. Confirm
DNS and TLS in Vercel, then verify both `/` and a direct route such as
`/u/<public-test-username>` return the app over HTTPS. The rewrite must serve
`index.html` for SPA routes; the root Vercel config provides this fallback.

### 3. FastAPI hosting setup

Choose a Python ASGI host that supports HTTPS, private environment variables,
health checks, and a platform-provided `PORT`. Configure its working directory
as `backend`, install `requirements.txt`, and set the start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Use the platform's supported Python version (the project supports Python 3.10+
and has been tested with Python 3.14). Configure:

```text
APP_ENV=production
SUPABASE_URL=https://<same-project-ref>.supabase.co
SUPABASE_ANON_KEY=<server-side-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
FRONTEND_ORIGINS=https://<exact-staging-or-production-frontend-origin>
LEETCODE_CACHE_TTL=21600
```

`FRONTEND_ORIGINS` is a comma-separated exact-origin allowlist, with no path
or trailing slash. Do not use `*`. Keep Preview and Production CORS origins
separate; add each exact stable Vercel preview origin only if needed. FastAPI
validates protected bearer tokens with Supabase Auth `get_user`; the verified
Auth UUID determines ownership. The service-role key is used only by the
backend and must never be logged or sent to React.

Enable the platform's HTTPS-only ingress and configure its liveness probe as
`GET /health` (expected HTTP 200). `/health` is a process liveness check, not a
database/SMTP readiness check. After start, manually verify
`https://<api-host>/health`, `/api/branches`, and that a protected route without
a bearer token returns 401. Keep API docs disabled at the host/network layer if
the production security policy requires private docs; current FastAPI exposes
`/docs` and `/openapi.json`.

### 4. Supabase Auth, RLS, and Brevo

In the intended Supabase project, verify the migration/schema state and RLS
policies in Dashboard/SQL Editor before promoting. Do not disable RLS to fix an
API error. The frontend uses only the project's publishable/anon key; confirm
service-role credentials are absent from frontend build assets and responses.

Configure Authentication URL settings:

- Set **Site URL** to the canonical production HTTPS frontend origin.
- Add the exact production login/OTP redirect URL(s) used by the app and the
  local/staging URLs needed for those environments to **Redirect URLs**.
- Add the staging site's URLs only to the staging project where possible.
- Verify email signup and OTP settings and set appropriate Auth rate limits.

Brevo remains configured as Supabase Auth custom SMTP. Verify its SMTP relay,
credential, sender identity/domain, DNS authentication, delivery quota, and
delivery logs in Supabase/Brevo dashboards. Do not copy SMTP credentials into
this repository or Vercel.

### 5. Production promotion and verification

Only after staging passes: back up production, manually review/approve pending
migrations in order, configure production-only variables and CORS, deploy the
backend, verify its HTTPS health/API responses, then promote the tested Vercel
build and bind the production domain. Keep a rollback path to the prior
frontend/backend builds. No deployment, production migration, or live
configuration change has been performed by this task.

### Production end-to-end checklist

- [ ] First-time registration with a dedicated university-email test account;
      OTP delivered through Supabase Auth/Brevo, then profile and LeetCode link
      created once.
- [ ] Reject invalid university email and prevent duplicate registration.
- [ ] Returning account requests OTP without creating a user; valid OTP restores
      a session; invalid/expired OTP and resend cooldown display safe messages.
- [ ] Session persists on reload; logout clears access and protected routes
      redirect unauthenticated visitors.
- [ ] Dashboard displays the signed-in user's profile and cached stats; profile
      edits and own LeetCode connection updates persist.
- [ ] Manual LeetCode sync succeeds or reports an unavailable-provider error
      without losing prior cached values; subsequent dashboard loads use cache.
- [ ] Anonymous public access works for public profiles; private profiles,
      email, tokens, private settings, and other private fields remain hidden.
- [ ] Leaderboard search, branch/year filters, sorting, pagination, missing
      stats, and username-to-public-profile navigation work.
- [ ] Verify owner-only modifications, RLS policies, all required constraints,
      and no service-role/SMTP/database secret in Vercel bundles, network
      responses, API logs, or repository history.
- [ ] Test desktop, tablet, and mobile widths; check browser console/network
      errors, API logs, loading/empty/error states, and direct SPA route loads.
- [ ] Verify HTTPS and DNS for both production frontend and API; confirm CORS
      allows only intended exact origins.

### Current verification limits

The local frontend tests, lint, production build, backend suite, and `/health`
smoke check have been run. The build warns that the main JavaScript chunk
exceeds 500 kB. Live Supabase schema/RLS and public leaderboard/profile
projections were inspected, and two explicitly approved profiles were synced.
Vercel project access is currently denied, so deployment settings and logs
could not be inspected. Supabase Auth email delivery through Brevo and browser
responsive flows were not verified. The live migration ledger lists only
001–005 although objects from 006–011 exist; reconcile that history before any
production migration command. Migration 012 is local and unapplied.

## Verification status and known limitations

The final local test and build results are recorded in the handoff for this
workspace. LeetCode integration uses its public GraphQL interface, which is not
a documented stable API. Optional profile and topic fields may be absent or
change; valid core counts are retained when optional data is unavailable.
Cached reads do not call LeetCode; syncs use a server-side lease and do not
bypass login, CAPTCHAs, or anti-bot controls. A successful build or mocked test
does not establish production deployment readiness.

LeetCode integration uses its public GraphQL interface, which is not a
documented stable API. Optional profile and topic fields may be absent or
change; valid core counts are retained when optional data is unavailable.
Cached reads do not call LeetCode; syncs use a server-side lease and do not
bypass login, CAPTCHAs, or anti-bot controls. A successful build or mocked test
does not guarantee live LeetCode availability.
