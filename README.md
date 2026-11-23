# CPHub

CPHub is a university-exclusive competitive-programming community for DSU
students. The React application uses Supabase Auth for email/password and OTP
authentication, and a FastAPI backend for student profiles, cached LeetCode
statistics, and leaderboard data stored in Supabase PostgreSQL.

## Architecture

```text
Frontend/                         React 19 + Vite application
  src/
    pages/                        Home, login, leaderboard, profiles, resources
    context/AuthContext.jsx       Supabase session restoration and auth events
    services/authService.js       OTP, password login, recovery, logout
    services/api.js               Shared FastAPI requests and bearer token
    services/profileApi.js        Profile and branch API
    services/leaderboardApi.js    Leaderboard API
    services/leetcodeApi.js       Private stats and refresh API
  supabase/migrations/            Database migrations 001–006

backend/                          FastAPI application
  app/routes/                     Health, profile, LeetCode, leaderboard, branches
  app/services/                   Supabase and LeetCode business logic
  app/schemas/                    Pydantic validation and API responses
  tests/                          Backend unit and route tests
```

Supabase Auth owns account creation, email confirmation, sessions, and password
recovery. The browser sends the current access token to FastAPI for protected
requests. FastAPI validates it with Supabase Auth and derives the profile
owner from that validated identity. Public profile and leaderboard data are
returned through explicitly projected database functions; direct table reads
are owner-restricted by RLS. LeetCode statistics are fetched and cached by the
backend, not by React.

The workspace also contains a root-level `src/` snapshot. The documented and
tested Vite app is `Frontend/`; run frontend commands there. The root
`package.json` currently contains unresolved merge-conflict markers and is
not a valid npm manifest. The `Frontend/src/services/databaseService.js` file
is a legacy, unused data-service facade; active pages use the centralized API
services listed above.

## Requirements and dependencies

- Node.js 20.19+ or 22.12+ and npm (Vite 8 requirement).
- Python 3.10 or later.
- A Supabase project with Auth, PostgreSQL, and the migrations below applied.
- A LeetCode public profile for student statistics (optional).

Frontend dependencies are declared in `Frontend/package.json`: React, React
DOM, Supabase JS, Vite, and ESLint. Backend dependencies are declared in
`backend/requirements.txt`:

- FastAPI and Uvicorn for the HTTP API.
- Pydantic and pydantic-settings for validation and environment configuration.
- Supabase Python SDK for Auth and database operations.
- HTTPX for the server-side LeetCode request.
- python-dotenv for local environment files.

## Frontend setup

```bash
cd Frontend
npm install
cp .env.example .env.local
```

Set the frontend values in `Frontend/.env.local`:

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

1. Configure Supabase Auth email templates to display the numeric token using
   `{{ .Token }}` for email OTP flows. Password signup confirmation uses the
   `signup` OTP type; the passwordless email-code flow uses the `email` type.
2. Enable email/password Auth and configure allowed redirect URLs for local
   development and production. Password recovery remains a Supabase Auth
   recovery-link flow.
3. If using a custom SMTP provider such as Brevo, configure its verified
   sender and SMTP credentials in the Supabase Dashboard. SMTP credentials
   belong in Supabase settings, not this repository or React.
4. CPHub accepts verified student addresses ending in `@dsu.cp.in` or
   `@dsu.edu.in`.
5. Preserve RLS. Do not disable RLS or add public table-wide read policies to
   make the API work. The public data functions are the intended projection
   boundary.

## Database migrations

Apply migrations in order in the Supabase SQL Editor (or with the Supabase
CLI after linking the intended project):

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Profiles, LeetCode cache, indexes, triggers, and owner policies. |
| `002_leetcode_provider.sql` | Server-side LeetCode refresh state and restricted refresh RPCs. |
| `003_user_profiles_api.sql` | Username and atomic profile creation/completion function. |
| `004_leetcode_stats_metadata.sql` | Optional rating/ranking fields and successful-refresh RPC. |
| `005_public_leaderboard.sql` | Database-backed leaderboard projection, filters, sorting, and pagination. |
| `006_secure_public_profile_access.sql` | Owner-only direct table reads and safe public profile/leaderboard RPC access. |

Migration files are in `Frontend/supabase/migrations/`. A mirror is maintained
in the root `supabase/migrations/` directory. For an existing project, apply
only migrations that are not already installed; do not rerun earlier
production migrations just because the checked-in source has changed. In
particular, apply migration 006 before deploying the backend code that reads
public profiles through its new RPC. Verify that RLS remains enabled and that
direct anonymous reads of `profiles` and `leetcode_stats` are denied.

With the Supabase CLI, run from `Frontend/` after confirming the project link:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Review the CLI's pending migration list before applying it to production.

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

- Password signup sends a Supabase signup confirmation OTP; the student
  enters the numerical code on the verification screen.
- Password login uses Supabase password authentication. Passwordless email
  OTP sign-in remains available.
- The frontend restores the Supabase session and listens for auth-state
  changes. An authenticated user without a completed profile is directed to
  `/my-profile`.
- Students create or edit their own profile through FastAPI. Public profiles
  and the leaderboard omit university email, Auth IDs, and credentials.
- The LeetCode refresh endpoint derives its owner from the validated bearer
  token. Successful statistics are cached; failed refreshes preserve the last
  successful result.
- Implemented application paths include `/`, `/home`, `/login`, `/signin`,
  `/leaderboard`, `/profile/:username`, `/my-profile`, and `/resources`.
  `/dashboard`, `/contests`, and `/rankings` currently display placeholders.

## Production deployment

### Frontend

Deploy the Vite application from `Frontend/` (for example, configure that
directory as the Vercel project root). Set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL` in the hosting
provider's frontend build environment. Set `VITE_API_BASE_URL` to the public
FastAPI origin. Configure SPA fallback/rewrite behavior so direct navigation
to `/profile/:username` and other client routes serves `index.html`.

### Backend

Deploy `backend/` as a Python ASGI service. Install `backend/requirements.txt`
and use a production command such as:

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`FRONTEND_ORIGINS`, and `LEETCODE_CACHE_TTL` in the hosting provider's
server-side environment settings. Add the exact production frontend origin to
`FRONTEND_ORIGINS`. Never put backend secrets in Vercel's `VITE_*` variables.
Configure HTTPS, health checks against `/health`, and suitable service
timeouts/limits in the hosting platform.

### Manual production checks

After deployment and applying migrations, verify Auth email delivery, OTP
verification, password login/logout, session restoration/expiry, onboarding,
profile ownership, public profile privacy, LeetCode refresh/cache failure
handling, leaderboard filtering/pagination, and database-empty states with
test accounts. Confirm Supabase RLS and hosting CORS settings in the actual
project; automated mock tests cannot verify dashboard configuration.

## Verification status and known limitations

The following checks were run for this workspace:

- Frontend tests: passed (analytics, LeetCode provider validation, and 21
  mocked Auth tests).
- Frontend production build: passed, with a Vite warning that the main
  JavaScript bundle exceeds 500 kB minified.
- Backend unit/route tests: passed (50 tests, including the empty leaderboard
  response case).
- In-process API smoke tests: `/health`, `/docs`, `/openapi.json`,
  `/api/branches`, and localhost CORS preflight returned HTTP 200.
- Frontend lint: currently fails on the existing
  `react-refresh/only-export-components` diagnostic in
  `Frontend/src/context/AuthContext.jsx`.
- Browser-based console and responsive interaction checks, real email
  delivery, live Supabase/RLS behavior, and real LeetCode requests were not
  verified in this environment. Local server port binding was denied;
  `backend/.env` and `Frontend/.env.local` are absent in this workspace.

LeetCode's public GraphQL interface is unofficial and may change or rate-limit
requests. A successful backend build or mocked provider test does not guarantee
that LeetCode is reachable in production.
