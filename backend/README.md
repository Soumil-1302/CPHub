# CPHub FastAPI backend

This is a separate FastAPI application. The existing React/Vite frontend and
Supabase Auth flow are unchanged. Profile endpoints use the existing
`public.profiles` table. The authenticated LeetCode refresh endpoint fetches
public profile statistics server-side and caches successful results in the
existing `public.leetcode_stats` table.

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
separate server-only client for profile and LeetCode cache operations. Public profile
reads use the anon client and the existing public-read RLS policy. The
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
determine write ownership. The profile endpoints and LeetCode refresh endpoint are implemented; the
leaderboard route remains an unimplemented scaffold.

Authentication failures return the same generic 401 response for missing,
malformed, invalid, and expired tokens. Supabase/network availability failures
return a generic 503. Neither responses nor logs include bearer tokens, email
addresses, or credential values.

## Run

From the repository root, use:

```bash
cd backend
uvicorn app.main:app --reload
```

- Health: <http://127.0.0.1:8000/health>
- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

The API includes `/health`, profile endpoints under `/api/profile`, the public
leaderboard at `/api/leaderboard`, and the authenticated LeetCode refresh
endpoint at `/api/leetcode/refresh`. The profile API is:

| Method | Path | Access | Behavior |
|---|---|---|---|
| `GET` | `/api/profile/me` | Bearer token | Returns the caller's profile and their private university email; returns 404 until a username is claimed. |
| `POST` | `/api/profile` | Bearer token | Creates/completes the caller's profile without replacing existing non-empty profile values. |
| `PUT` | `/api/profile/me` | Bearer token | Updates only the caller's profile. |
| `GET` | `/api/profile/{username}` | Public | Returns an explicitly selected public profile projection; never returns email or Auth IDs. |

### Public leaderboard

`GET /api/leaderboard` reads real profile and cached-stat rows from Supabase
through a database-side RPC. It includes only profiles with a claimed public
CPHub username; students without a LeetCode handle or a successful stats
refresh remain listed with zero solve counts. The one-to-one profile and
stats keys prevent duplicate students.

Supported query parameters:

| Parameter | Behavior |
|---|---|
| `branch` | Branch name or code from `Frontend/src/data/branches.json`. |
| `year` | Four-digit year of passing. |
| `sort_by` | `total_solved`, `easy_solved`, `medium_solved`, `hard_solved`, `contest_rating`, or `name`. |
| `sort_order` | `asc` or `desc`. |
| `limit` / `offset` | Database pagination; limit is 1–100. |
| `search` | Matches public CPHub username, display name, or USN. |

Example: `/api/leaderboard?branch=CSE&year=2028&sort_by=total_solved&limit=20&offset=0`.
The response's student entries retain the frontend's public keys (`username`,
`name`, `usn`, `branch`, `year`, `leetcode`, and `total`) and include breakdown,
rank, and optional rating fields. Summary and pagination metadata are returned
alongside the student list. Email addresses, Auth IDs, and credentials are
never selected or returned. The existing leaderboard page uses this endpoint
and no longer loads `students.json`.

Apply `Frontend/supabase/migrations/005_public_leaderboard.sql` after migrations
001–004. It creates a security-invoker RPC, so existing public-read RLS
policies remain in effect, and adds indexes for leaderboard filters and
supported numeric sorts.

### LeetCode statistics

The React app calls `POST /api/leetcode/refresh` with the current Supabase
access token in `Authorization: Bearer <token>`. It does not call LeetCode
directly or send a LeetCode username to the refresh route. The backend derives
the caller's user ID from validated Supabase Auth, reads that user's saved
`leetcode_username`, and scopes every cache lookup and write to that identity.

The response includes total, easy, medium, and hard accepted-problem counts,
the submission calendar, and the profile URL. Contest rating, global ranking,
and recent submissions are included only when LeetCode returns usable values.
Topic breakdown is currently unavailable from the public profile query and is
returned as `null`.

The backend uses LeetCode's public GraphQL endpoint without a user session.
HTTP requests are made with the `httpx` dependency.
LeetCode does not provide a stable, documented public API contract for these
statistics; its endpoint and schema can change, block requests, or rate limit
CPHub. Optional GraphQL fields are isolated behind the backend provider and
the service retries the core statistics query if optional fields are rejected.
No LeetCode credentials or third-party scraping package are used.

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
against `Frontend/src/data/branches.json`; keep that shared data file available
when deploying the backend.

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
