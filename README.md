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
