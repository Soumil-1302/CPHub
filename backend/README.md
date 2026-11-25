# CPHub FastAPI backend

This is a separate FastAPI application. The React/Vite frontend uses Supabase
Auth email OTP for one-time registration and returning-user sign-in. Profile
endpoints use the existing `public.profiles` table. The authenticated
LeetCode refresh endpoint fetches public profile statistics server-side and
caches successful results in the existing `public.leetcode_stats` table.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with the existing Supabase project URL, its publishable/anon key,
the Supabase service-role key, the deployed frontend origin, and the desired
LeetCode cache TTL in seconds. `FRONTEND_ORIGINS` is a comma-separated list;
include only the exact origins that should call the API.

The existing frontend's `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` correspond to backend `SUPABASE_URL` and
`SUPABASE_ANON_KEY`. Obtain `SUPABASE_SERVICE_ROLE_KEY` from the Supabase
project's server-side API settings; do not copy it to any frontend config.

The health endpoint and Swagger UI work without Supabase credentials.
Protected routes validate the bearer access token against Supabase Auth using
`SUPABASE_URL` and `SUPABASE_ANON_KEY`. The service-role key is kept in a
separate server-only client for profile and LeetCode cache operations. Public
profile reads use a narrowly projected database RPC; direct table reads are
restricted to the authenticated owner. The
service-role key must never be put in React, a `VITE_*` variable, API
responses, or logs. `.env` is ignored by Git.

The React app continues to authenticate users with its existing Supabase
browser client. For protected API requests, send the session access token:

```http
Authorization: Bearer <supabase-session-access-token>
```

FastAPI asks Supabase Auth to validate that token and uses only the returned
Auth user UUID as the authenticated identity. Protected profile writes must
use that identity as the row owner; a client-supplied user ID must never
determine write ownership. Profile, dashboard, leaderboard, branch catalogue, and LeetCode refresh
endpoints are implemented.

Authentication failures return the same generic 401 response for missing,
malformed, invalid, and expired tokens. Supabase/network availability failures
return a generic 503. Neither responses nor logs include bearer tokens, email
addresses, or credential values.

`POST /api/auth/otp` is the unauthenticated entry point required for
registration and sign-in. It accepts a university email plus `register` or
`login` intent, uses the service-role-only `auth_user_exists` RPC to prevent
duplicate Auth account creation, and asks Supabase Auth to send the OTP. It
returns the same response for known and unknown addresses. Supabase Auth
enforces its configured delivery rate limits; the frontend additionally
applies a 60-second resend cooldown.
Apply `Frontend/supabase/migrations/008_passwordless_registration.sql` to the
intended Supabase project before enabling this route and profile completion.
Apply `Frontend/supabase/migrations/009_leetcode_public_profile_cache.sql`
after migrations 007 and 008 before deploying this LeetCode service version.
Apply `Frontend/supabase/migrations/010_public_profile_analytics.sql` after
migration 009 to serve cached activity and topic analytics in public profiles.
Apply `Frontend/supabase/migrations/011_leaderboard_public_statistics.sql`
after migration 010 and before deploying the leaderboard response/UI update.

## Run

From the repository root, use:

```bash
cd backend
uvicorn app.main:app --reload
```

- Health: <http://127.0.0.1:8000/health>
- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

The API includes `/health`, OTP request at `/api/auth/otp`, profile endpoints under `/api/profile`, the public
leaderboard at `/api/leaderboard`, and the authenticated LeetCode refresh
endpoint at `/api/leetcode/refresh`. The authenticated personal dashboard is
available at `GET /api/dashboard/me`; it returns the caller's public profile
fields and cached LeetCode statistics without exposing their email or Auth ID.
If LeetCode statistics have not been cached yet, `data.leetcode` is `null`.
LeetCode cached reads are available at `/api/leetcode/profile`, `/stats`,
`/activity`, `/topics`, and `/account`. `POST /api/leetcode/sync` refreshes
the caller's saved account; `GET /api/leetcode/sync-status` returns that
account's latest synchronization state and safe error message;
`PUT /api/leetcode/account` validates and updates only that caller's LeetCode
connection. Cached reads never call LeetCode. Synchronization is synchronous
and uses the database's atomic per-username lease and rate-limit claim; no
background worker or external queue is required.
The dashboard loads those cached results before fetching saved activity,
topic, account, and settings details. Activity requests accept up to 3,660
stored dates; unavailable history is not synthesized. Settings are available
at `GET`/`PUT /api/settings/me`, and `DELETE /api/settings/account` requires
an explicit `DELETE` confirmation. These operations derive ownership from
the verified Supabase token.
The profile API is:

Both `POST /api/profile` and `POST /api/profile/registration` require the full
registration payload and use the same atomic completion RPC. A completed
profile cannot be registered a second time.

| Method | Path | Access | Behavior |
|---|---|---|---|
| `GET` | `/api/profile/me` | Bearer token | Returns the caller's profile and their private university email; returns 404 until a username is claimed. |
| `POST` | `/api/profile` | Bearer token | Creates/completes the caller's profile without replacing existing non-empty profile values. |
| `PUT` | `/api/profile/me` | Bearer token | Updates only the caller's profile. |
| `GET` | `/api/profile/{username}` | Public | Returns an explicitly selected public profile projection; never returns email or Auth IDs. |

Public profiles are also available at frontend URLs `/u/{username}`. The
public API projection includes only profile fields, cached LeetCode counts,
global ranking when available, and cached activity/topic data. It returns 404
for unknown or private profiles, including when requested by the profile
owner; owners can access private data through the authenticated personal
dashboard. Activity and topic analytics are sourced from cached LeetCode
statistics and are marked unavailable when the public data is missing.

The `POST /api/profile` and `POST /api/profile/registration` routes both
require the complete registration payload and call the same atomic RPC. The
older profile-creation behavior is no longer available, and a profile with an
existing username cannot be registered again.

### Public leaderboard

`GET /api/leaderboard` reads real profile and cached-stat rows from Supabase
through a database-side RPC. It includes only profiles with a claimed public
CPHub username; students without a LeetCode handle or a successful stats
refresh remain listed with zero solve counts. The one-to-one profile and
stats keys prevent duplicate students. It reads cached LeetCode aggregates
only; loading this endpoint never makes per-user LeetCode requests. Ranking
defaults to total problems solved, then full name and username for stable ties.

Supported query parameters:

| Parameter | Behavior |
|---|---|
| `branch` | A branch name or code supported by the backend branch catalogue. |
| `year` | Four-digit year of passing. |
| `sort_by` | `total_solved`, `easy_solved`, `medium_solved`, or `hard_solved`. |
| `sort_order` | `asc` or `desc`. |
| `limit` / `offset` | Database pagination; limit is 1–100. |
| `search` | Matches public CPHub username or full name. |

Example: `/api/leaderboard?branch=CSE&year=2028&sort_by=total_solved&limit=20&offset=0`.
The response contains only approved public fields: avatar, full name, username,
branch, graduation year, cached total and difficulty counts, LeetCode global
ranking, LeetCode profile link, and statistics refresh time. Email, Auth IDs,
USNs, and private settings are not selected or returned. Missing stats show
zero counts and an unavailable ranking/update time. Database-side pagination,
filters, and ordering are applied before the response is returned.
`GET /api/branches` provides the canonical branch choices independently of
student records, so filters and onboarding remain usable when the database is
empty.

Apply `Frontend/supabase/migrations/005_public_leaderboard.sql` after migrations
001–004. It creates the leaderboard RPC with an explicit public projection and
adds indexes for leaderboard filters and supported numeric sorts.

Then apply `Frontend/supabase/migrations/006_secure_public_profile_access.sql`
in the Supabase Dashboard SQL Editor. This migration removes anonymous access
to the underlying `profiles` and `leetcode_stats` tables, restricts direct
authenticated reads to each user's own rows, and leaves RLS enabled. Public
profile and leaderboard reads continue through narrowly projected RPCs; those
functions do not return profile IDs, email addresses, or private statistics.
Run the complete migration file after 005 and verify it succeeds before
deploying this backend version. The migration is also mirrored at
`supabase/migrations/006_secure_public_profile_access.sql`.

### LeetCode statistics

The React app calls `POST /api/leetcode/refresh` with the current Supabase
access token in `Authorization: Bearer <token>`. It does not call LeetCode
directly or send a LeetCode username to the refresh route. The backend derives
the caller's user ID from validated Supabase Auth, reads that user's saved
`leetcode_username`, and scopes every cache lookup and write to that identity.

The cached response includes total, easy, medium, and hard accepted-problem
counts, the profile URL, and daily submission activity where available. Contest
rating, global ranking, recent submissions, public profile metadata, and topic
counts are optional and omitted or marked unavailable when the public data is
missing. Submission-calendar values represent submissions, not distinct
accepted problems.

The backend uses LeetCode's public GraphQL endpoint without a user session.
HTTP requests are made with the `httpx` dependency.
The public GraphQL endpoint does not have a stable, documented public API
contract for these statistics; its schema can change, block requests, or rate
limit CPHub. Core counts are validated separately from optional profile/topic
data, so optional-field errors do not discard valid counts. No LeetCode
credentials are used, and the integration does not bypass login, CAPTCHAs, or
anti-bot protections. Refreshes use a six-hour default cache and database
leases to avoid repeated or concurrent upstream calls.

Successful results are cached in `public.leetcode_stats`; failed provider
requests update fetch-state metadata only and do not overwrite the last
successful statistics. `LEETCODE_CACHE_TTL` controls the cache lifetime
(default: 21,600 seconds / six hours). The existing database fetch lease and
minimum interval prevent concurrent or excessive upstream requests. A fresh
cache is returned without making an external request. Errors return a stable
`{ success, cached, data, error }` shape; stale successful data may be included
when a refresh fails.

For frontend development, set `VITE_API_BASE_URL=http://localhost:8000` in
`Frontend/.env.local`; set it to the deployed FastAPI origin in Vercel. This
value is only an API URL, not a credential. Set the corresponding frontend
origin in backend `FRONTEND_ORIGINS`. Never put the Supabase service-role key
or any server credential in a `VITE_*` variable.

Profile email is read from the validated Supabase Auth user and is not copied
into the public profiles table. LeetCode URLs are validated and converted to
the existing `leetcode_username` field. Branch names/codes are validated
against the backend branch catalogue; no frontend data file is required.

## Database migration

The existing schema already provides `public.profiles`, the Auth-user foreign
key, profile timestamps, signup trigger, and RLS. Apply
`Frontend/supabase/migrations/003_user_profiles_api.sql` after migrations 001
and 002. It adds a nullable username column and case-insensitive unique index
for legacy-safe profile claiming, plus an atomic function that fills
trigger-created placeholder profiles without overwriting existing non-empty
values. It does not create another table or weaken RLS. The function can only
be called by `service_role`.

To apply it:

1. Open the existing Supabase project in the Dashboard and select **SQL
   Editor**.
2. Open `Frontend/supabase/migrations/003_user_profiles_api.sql` locally,
   copy its complete contents into a new SQL query, and run it.
3. Confirm the query succeeds. In **Table Editor → profiles**, verify the
   nullable `username` column and its unique index.
4. Do not edit or remove the existing RLS policies.

The migration intentionally does not populate usernames for existing
profiles. Those users can claim a username by posting their profile; the
creation function preserves fields that already contain data. Before applying
to production, confirm prior migrations 001 and 002 have been applied.

The LeetCode cache uses the existing tables and fetch-claim RPCs from
migration 002. Apply
`Frontend/supabase/migrations/004_leetcode_stats_metadata.sql` after migrations
001 and 002 to add nullable optional-stat columns and an atomic success RPC
that persists those fields without weakening RLS:

1. In the Supabase Dashboard, open **SQL Editor**.
2. Copy the full contents of
   `Frontend/supabase/migrations/004_leetcode_stats_metadata.sql` into a new
   query and run it.
3. Confirm it succeeds before deploying the backend code that calls
   `finish_leetcode_fetch_success_v2`.

Apply migration 005 only after migration 004, because the leaderboard reads
the optional contest-rating column introduced there.

The current platform schema also requires migration 007 for the normalized
LeetCode account/activity/topic/sync tables. Migration 007 was reported as
applied by the project owner. Apply migration 008 for OTP registration if it
has not already been applied, then apply
`Frontend/supabase/migrations/009_leetcode_public_profile_cache.sql` before
deploying this version of the LeetCode service. Migration 009 is additive; it
adds cached public profile metadata, optional total-submission/acceptance-rate
fields, and an atomic sync RPC. It preserves saved optional values when LeetCode
omits them for the same handle, avoids carrying old-handle values into a
replacement connection, and resets account `last_synced_at` when the connected
handle changes.
