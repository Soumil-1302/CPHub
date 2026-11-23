# CPHub Frontend

**CPHub** is the problem-solving community platform for Dayananda Sagar University (DSU). It ranks students by LeetCode problems solved and provides campus leaderboards, batch breakdowns, and profile milestones.

---

## 🛠 Tech Stack

- **Framework:** React 19 + Vite 8
- **Styling:** Modular Vanilla CSS & Design Tokens (no heavy Tailwind dependencies)
- **Linting & Code Quality:** ESLint 10 + Flat Config (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)
- **Testing:** Node.js native test assertions

---

## 📁 Project Architecture

The project follows a modular, feature-grouped architecture designed for scalability, separation of concerns, and clean developer workflows:

```text
Frontend/
├── index.html                   # HTML entry point
├── package.json                 # Dependencies and npm scripts
├── vite.config.js               # Vite bundler configuration
├── eslint.config.js             # ESLint flat config
├── PROJECT_STRUCTURE.md         # In-depth architectural documentation
│
├── public/                      # Static publicly served assets (favicons, logos)
│   ├── lc.jpeg                  # LeetCode logo
│   ├── favicon2.png             # App favicon
│   └── icons.svg                # Shared SVG icons
│
├── supabase/                    # Database migration and Edge Function
│   ├── config.toml              # Function JWT verification settings
│   ├── migrations/              # Database migrations
│   └── functions/               # Server-side LeetCode stats provider
│
└── src/
    ├── main.jsx                 # Application bootstrapping & root render
    ├── App.jsx                  # Root router, global providers, and state
    │
    ├── constants/               # Fixed configuration values and routes
    │   └── routes.js            # Centralized application route definitions
    │
    ├── data/                    # Static datasets and mappings
    │   ├── branches.json        # University department code-to-name mapping
    │   └── students.json        # Student identity, university, and LeetCode data
    │
    ├── services/                # Supabase auth, database, and function calls
    │   ├── authService.js       # University email OTP auth service
    │   ├── databaseService.js   # Profile, stats, and Edge Function access
    │   └── supabaseClient.js    # Browser Supabase client
    │
    ├── utils/                   # Pure business logic and analytics helpers
    │   ├── studentAnalytics.js  # LeetCode-only ranking and campus statistics
    │   └── studentAnalytics.test.js # Unit test suite for analytics functions
    │
    ├── components/              # Modular UI components
    │   ├── common/              # Shared presentational widgets
    │   │   └── BackgroundEffects.jsx
    │   │
    │   ├── layout/              # Application frame, navigation, and footers
    │   │   ├── Navbar.jsx
    │   │   ├── FloatingNavbar.jsx
    │   │   └── ClosingCTA.jsx
    │   │
    │   ├── cursor/              # Physics-driven kinetic cursor system
    │   │   ├── MagicCursor.jsx
    │   │   └── CursorController.jsx
    │   │
    │   ├── home/                # Home page feature sections
    │   │   ├── HeroSection.jsx
    │   │   ├── CommunitySnapshot.jsx
    │   │   ├── PlatformShowcase.jsx
    │   │   ├── LeaderboardPreview.jsx
    │   │   └── ContestsCommunity.jsx
    │   │
    │   └── leaderboard/         # Leaderboard feature sections
    │       ├── LeaderboardHeader.jsx
    │       ├── LeaderboardFilters.jsx
    │       ├── LeaderboardTable.jsx
    │       └── LeaderboardRow.jsx
    │
    ├── pages/                   # Top-level page views
    │   ├── Home.jsx             # Editorial landing page
    │   ├── Leaderboard.jsx      # Filterable student ranking page
    │   └── Login.jsx            # University email authentication page
    │
    └── styles/                  # Modular stylesheets
        ├── global.css           # Design tokens, variables, typography, reset
        ├── home.css             # Landing page responsive styles
        ├── leaderboard.css      # Table, filters, and podium styles
        ├── auth.css             # Login card and form styles
        ├── cursor.css           # Floating cursor dock and settings styles
        ├── background.css       # Animated ambient gradient backdrop
        └── navbar.css           # Desktop and mobile navigation styles
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
cd Frontend
npm install
```

### Development Server

Start the local Vite development server with HMR:

```bash
npm run dev
```

The application will be live at `http://localhost:5173/`.

### Running Tests

Execute the unit test suite verifying data transformations and ranking calculations:

```bash
npm test
```

### Linting

Run ESLint to check for syntax and hook rules:

```bash
npm run lint
```

### Production Build

Create an optimized production bundle in `dist/`:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Email OTP Authentication

The React login page at `/login` accepts valid student addresses ending in
either `@dsu.cp.in` or `@dsu.edu.in`.
Password registration uses Supabase Auth `signUp({ email, password })`, then
confirms the account by calling `verifyOtp({ email, token, type: 'signup' })`.
Password login uses `signInWithPassword`. The existing passwordless email-code
sign-in remains available and uses `signInWithOtp({ shouldCreateUser: true })`
with `verifyOtp({ type: 'email' })`. Signup confirmation resend uses
`supabase.auth.resend({ type: 'signup', email })`.

Supabase Auth generates and verifies the OTP codes and manages sessions.
Brevo is the intended SMTP delivery provider; once custom SMTP is configured
in Supabase Dashboard, Supabase Auth delivers its messages through Brevo.
Repository code cannot confirm Dashboard settings. CPHub does not generate
codes or send authentication email directly from React or its Edge Function.
The PostgreSQL `on_auth_user_created` trigger creates a profile row linked to
the new Auth user ID.

### Supabase email templates

Configure Supabase **Authentication → Email Templates → Confirm signup** to
show the numeric signup confirmation token using `{{ .Token }}`. Example:

```html
<div style="font-family: Arial, sans-serif; color: #161618; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
  <div style="font-size: 24px; font-weight: 700; letter-spacing: 1px; color: #10a09c;">CPHub</div>
  <h1 style="font-size: 22px; margin: 28px 0 12px;">Verify your email</h1>
  <p style="font-size: 16px; line-height: 1.5;">Enter this code on CPHub to verify your student account:</p>
  <div style="margin: 24px 0; padding: 16px; background: #f5f5f4; border-radius: 8px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px;">
    {{ .Token }}
  </div>
  <p style="font-size: 14px; line-height: 1.5;">
    Return to CPHub and enter the code in the signup verification form.
  </p>
  <p style="font-size: 13px; color: #71717a;">
    If you did not request this code, you can ignore this email.
  </p>
</div>
```

The **Magic Link** template is used for the optional passwordless email-code
sign-in and must also display `{{ .Token }}` for that code-entry flow. Do not
use `{{ .ConfirmationURL }}` as the signup or passwordless sign-in verification
method. Keep **Reset Password** separate: password recovery remains a link
flow and its template should not be changed as part of signup OTP setup.

### Configure Brevo SMTP in Supabase

SMTP settings are managed in Supabase Dashboard, not in this repository:

1. Verify the sending domain in Brevo and publish the DNS records Brevo
   requires. Use an address on that verified domain as the sender.
2. In Brevo, obtain SMTP credentials (an SMTP key, not a browser/API key).
   Confirm the current relay host, port, and login values in Brevo.
3. In Supabase, open **Authentication → SMTP Settings**, enable custom SMTP,
   and enter the Brevo relay host, port, login, SMTP key, and verified sender
   address/name.
4. Save the settings and test delivery. Check Supabase Auth logs and Brevo
   transactional email logs if messages fail.

Brevo SMTP credentials must only be entered in Supabase's SMTP configuration
or approved server-side secret storage. Never commit them to GitHub or source
files, and never put them in a `VITE_*` variable.

### Environment variables and limits

The browser Supabase client requires these Vite variables. For local
development, put them in `Frontend/.env.local`; set them separately in
Vercel's project environment settings for deployment:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

These are browser configuration values; the publishable key is not an SMTP
secret. Never expose a Supabase service-role key to the frontend. The
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables
used by the LeetCode Edge Function must be configured as server-side function
secrets; the service-role key must never be included in the frontend bundle.

The login UI applies a 60-second cooldown per normalized email address and
blocks concurrent send, resend, and verification requests. This is a client
safeguard only; it does not raise, bypass, or configure Supabase's server-side
email limits. Review the current limits in Supabase **Authentication → Rate
Limits** and configure them for the project and its SMTP provider. Supabase
Auth limits still apply when using custom SMTP.

Brevo sending quotas depend on the account, plan, and current provider
restrictions. Check Brevo's dashboard for the active quota, usage, and sender
verification state instead of assuming a fixed sending limit.

### Password reset redirect

The password reset form calls Supabase Auth
`resetPasswordForEmail(email, { redirectTo })`. Add the production redirect URL
`https://<your-vercel-domain>/login?mode=recovery` (and the local development
equivalent) to Supabase **Authentication → URL Configuration → Redirect URLs**.
The recovery callback is handled through the Supabase `PASSWORD_RECOVERY` auth
event, and the new password is saved using `updateUser({ password })`.

### Troubleshooting

- **Too many OTP requests:** wait for the displayed cooldown and check Supabase
  Authentication rate-limit settings. The client cooldown cannot override
  server limits.
- **Email not received:** check spam, Supabase Auth logs, Brevo transactional
  logs, sender/domain verification, and SPF/DKIM status.
- **SMTP rejected or delivery failed:** verify Brevo's current SMTP host, port,
  login, SMTP key, and sender address in Supabase. Never paste credentials in
  browser code or support messages.
- **Incorrect or expired code:** use the newest code and request another after
  the cooldown if it has expired.
- **Network error:** check browser connectivity and the Supabase project URL.
- **Unsupported email:** CPHub accepts only valid addresses ending in
  `@dsu.cp.in` or `@dsu.edu.in`.

Automated auth tests mock Supabase Auth and never send real email.

## LeetCode Statistics Provider

LeetCode statistics are requested only by the authenticated
`supabase/functions/leetcode-refresh` Edge Function. The browser asks the
function to refresh the signed-in user's saved LeetCode username; it does not
contact LeetCode or send LeetCode credentials. The provider adapter is isolated
in `supabase/functions/_shared/leetcodeProvider.js` so the upstream integration
can be replaced independently.

The adapter uses LeetCode's public-profile GraphQL response under the project's
authorization to use that endpoint. This GraphQL interface is undocumented and
may change; do not enable or use it without appropriate authorization. The
function validates the matched username, total and difficulty counts, and
calendar before storing anything. A 6-hour cache, a database-backed 5-minute
per-username request interval, a short provider timeout, and response-size
limits reduce upstream load. Failed attempts update private fetch state and do
not replace the last successful stats.

### Deploying

From `Frontend/`, link the Supabase CLI to the intended project and apply the
pending database migrations (including `002_leetcode_provider.sql`):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy leetcode-refresh
```

The function requires the standard server-side Supabase environment values
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`). Supabase
provides these to Edge Functions. Never put the service-role key in a `VITE_*`
variable, source code, or the browser bundle. JWT verification is enabled in
`supabase/config.toml`.

### Invoking

After deployment, sign in, save a LeetCode username in **My Profile**, and use
**Refresh LeetCode Stats**. The frontend calls `supabase.functions.invoke()`
with an empty JSON object; the function obtains the username from the
authenticated user's CPHub profile.

For a manual authenticated request, POST `{}` to
`https://<project-ref>.supabase.co/functions/v1/leetcode-refresh` with the
Supabase publishable key and the user's current Supabase access token:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/leetcode-refresh" \
  -H "apikey: <supabase-publishable-key>" \
  -H "Authorization: Bearer <user-access-token>" \
  -H "Content-Type: application/json" \
  --data '{}'
```

The Supabase token is for CPHub authentication only and is never sent to
LeetCode. Successful responses include normalized stats; failures include an
error code and preserve any previously saved successful stats.

The function is not deployed by this repository change. Provider validation
tests run with `npm test`.

---

## 🏛 Key Architectural Decisions

1. **LeetCode-only statistics:** Campus totals, leaderboard ranks, and profile solve counts are calculated from each student's LeetCode solve count. Student identity and university information remain independent of those statistics.
2. **Separation of Concerns:** Component files only handle presentation and local user events. Business logic (data normalization, branch resolution, ranking tie-breakers, campus summary math) is isolated in pure, testable functions in `src/utils/studentAnalytics.js`.
3. **Domain-Grouped Components:** Reusable components are organized by functional domain (`layout/`, `home/`, `leaderboard/`, `cursor/`, `common/`) rather than an unstructured flat folder.
4. **Dead Code Elimination:** Outdated boilerplate and orphan mock components (`Hero.jsx`, `Stats.jsx`, `Button.jsx`, `hero.css`, `stats.css`, `button.css`, `react.svg`) have been pruned to reduce bundle size and developer cognitive load.
5. **Resilient Data Layer:** `normalizeStudentsData` transparently handles both JSON arrays and object maps keyed by student USN, avoiding runtime type errors when backend data formats vary.
