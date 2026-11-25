# CPHub Architecture & Codebase Structure

This document describes the design patterns, architectural decisions, and directory layout implemented in the CPHub repository.

---

## 1. Directory Structure & Responsibilities

| Directory | Primary Responsibility | Notes |
| :--- | :--- | :--- |
| `src/constants/` | Global immutable values, route paths, navigation links | Includes centralized authentication and OTP configuration (`auth.js`). |
| `src/context/` | Application-wide React state | `AuthContext.jsx` restores the Supabase session and exposes auth state/sign-out. |
| `src/services/` | External API integrations & network requests | Supabase Auth and centralized FastAPI profile, leaderboard, and LeetCode requests. |
| `src/utils/` | Pure business logic, data calculations, algorithms | Includes OTP cooldown/request-lock controls; student-facing pages use database-backed API data. |
| `src/components/common/` | Universally shared presentational widgets | e.g. `BackgroundEffects.jsx` ambient background. |
| `src/components/layout/` | Structural layout and navigation elements | `FloatingNavbar.jsx`, `ClosingCTA.jsx`. |
| `src/components/cursor/` | Physics-driven animated cursor system | `MagicCursor.jsx` and user-facing `CursorController.jsx`. |
| `src/components/home/` | Home / Landing page feature sections | `HeroSection`, `CommunitySnapshot`, `PlatformShowcase`, `LeaderboardPreview`, `ContestsCommunity`. |
| `src/components/leaderboard/` | Leaderboard page components | `LeaderboardHeader`, `LeaderboardPodium`, `LeaderboardFilters`, `LeaderboardTable`, `LeaderboardRow`. |
| `src/components/profile/` | Individual student profile components | `ProfileHeader`, `PlatformBreakdown`, `ProfileComparison`, `ProfileNotFound`. |
| `src/pages/` | Top-level view containers mapping to routes | `Home.jsx`, `Leaderboard.jsx`, `Login.jsx`, `Profile.jsx`. |
| `src/styles/` | Global and scoped vanilla CSS stylesheets | Structured around the `#fbfaf8` light editorial design system (`home.css`, `auth.css`, `leaderboard.css`, `profile.css`). |

---

## 2. Core Modules & Data Flow

### 2.1 Email OTP Authentication

- **React UI:** `src/pages/Login.jsx` supports passwordless email-code
  registration/sign-in, legacy password login, and password recovery/update. It validates the university address,
  displays loading and actionable error states, and enforces a 60-second
  per-email resend cooldown while blocking overlapping requests.
- **Auth service:** `src/services/authService.js` sends registration/login OTP
  requests through the FastAPI `/api/auth/otp` route, which applies intent-aware
  account creation before Supabase sends the email. OTP verification and
  session restoration use Supabase Auth (`verifyOtp({ type: 'email' })`).
  Legacy password login and password recovery remain available. Password recovery uses
  `resetPasswordForEmail` and `updateUser`. Codes, accounts, and sessions are
  managed by Supabase; CPHub does not generate OTPs.
- **Auth state:** `src/context/AuthContext.jsx` restores the Supabase session,
  observes auth-state changes (including `PASSWORD_RECOVERY`), and exposes
  sign-out.
- **Rate-limit helpers and tests:** `src/constants/auth.js` centralizes the
  six-digit OTP length, 60-second cooldown, and the allowed `dsu.edu.in`
  domain.
  `src/utils/otpRequestControls.js` implements per-email cooldown and request
  locking. `src/services/authService.test.js` mocks Supabase Auth, so tests do
  not send real email.
- **Profile creation:** the `on_auth_user_created` PostgreSQL trigger creates
  a placeholder `public.profiles` row. The user completes their public username,
  university, branch, graduation year, and LeetCode handle through the protected
  FastAPI registration endpoint.
- **Email delivery:** Brevo is the intended custom SMTP provider. Configure
  Brevo SMTP in Supabase Dashboard under **Authentication → SMTP Settings**.
  Supabase Auth generates and verifies codes and sends the emails through
  Brevo; neither React nor a CPHub backend handles SMTP delivery. Provider
  credentials are not part of this repository.
- **Templates:** the Supabase **Confirm signup** template must display
  `{{ .Token }}` and ask students to enter the code on CPHub. The optional
  passwordless sign-in uses Supabase's **Magic Link** template and also needs
  `{{ .Token }}` for its code-entry flow. Password recovery remains a separate
  link-based template; do not replace it with an OTP confirmation template.
- **Configuration:** the browser uses `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` locally and in Vercel. Brevo SMTP
  credentials belong only in Supabase's Dashboard SMTP settings. Never commit
  SMTP credentials or expose them through `VITE_*`; Supabase service-role
  keys must never be exposed to the frontend.
- **Limits and domain:** the 60-second client cooldown is only a UX/security
  safeguard; it does not raise or bypass Supabase Auth server-side rate limits
  or Brevo account quotas. Review limits and current sending quotas in their
  respective dashboards. Verify the Brevo sending domain and DNS records.
  CPHub validation permits only `@dsu.edu.in`.
- **Redirects and testing:** allowlist the production and local
  `/login?mode=recovery` redirect URLs in Supabase Authentication URL
  Configuration. Run `npm test` from the repository root; tests use mocked Supabase
  methods and do not send email. A live Supabase integration test is not run by
  the local suite.

### 2.2 Student Data

Home, Leaderboard, and Profile request real profiles and cached LeetCode
statistics from FastAPI. The backend queries Supabase and returns public fields
only. Leaderboard filters and pagination are database-backed, and branch
choices come from the backend catalogue. Empty database results are rendered
as empty states rather than replaced with fixture records.

### 2.3 Navigation & Routing Architecture (`src/constants/routes.js`)

Route paths are centrally declared in `ROUTES`:

```javascript
export const ROUTES = {
  HOME: '/',
  HOME_ALIAS: '/home',
  LOGIN: '/login',
  SIGNIN: '/signin',
  LEADERBOARD: '/leaderboard',
  PROFILE_BASE: '/u',
  LEGACY_PROFILE_BASE: '/profile',
  profile: (username) => `/u/${encodeURIComponent(username || '')}`,
  DASHBOARD: '/dashboard',
  CONTESTS: '/contests',
  RANKINGS: '/rankings',
}
```

Dynamic route patterns in `App.jsx` parse direct URLs such as `/u/:username` and preserve `/profile/:username` as a legacy alias.

### 2.4 Page Implementations

1. **Sign In (`/login` & `/signin` via `src/pages/Login.jsx` & `src/styles/auth.css`)**:
   - Passwordless registration and email-code sign-in through the backend OTP
     route; legacy password sign-in and recovery remain available.
   - Passwordless university email OTP sign-in and verification.
   - University email domain validation and per-email resend cooldown.
   - Backend profile completion after OTP verification.

2. **Leaderboard (`/leaderboard` via `src/pages/Leaderboard.jsx` & `src/styles/leaderboard.css`)**:
   - Header with active student count, LeetCode solve count, and active departments.
   - Top 3 podium showcase cards (🥇 1st Place, 🥈 2nd Place, 🥉 3rd Place) with direct profile links.
   - Filter bar with search by CPHub username or name; department dropdown; graduation batch dropdown; metric sort selection; sort order toggle; and reset button.
   - Responsive table displaying Rank, Username, Student Name & USN, Department, and LeetCode solves with profile navigation.
   - Efficient client pagination (20 per page) with page number controls.

3. **Individual User Profile (`/u/:username` via `src/pages/Profile.jsx` & `src/styles/profile.css`)**:
   - Header with back-to-leaderboard button, initials avatar, student name, `@username`, university, department, and batch tags.
   - Quick stats grid: Overall campus rank, Department rank, Cohort batch rank, and LeetCode solves.
   - Dedicated LeetCode card: recorded solve count, stacked difficulty bar, Easy/Medium/Hard counts, and external link.
   - Benchmark card: LeetCode campus percentile and earned campus milestone badges.
   - Graceful 404 / Missing student state with suggestions for top campus leaders.

---

## 3. Maintenance Rules for Developers

1. **Keep Page Components Lean:** Page components (`src/pages/*`) should serve as orchestrators connecting layout, state, and feature sections. Do not embed raw data processing in pages; use `src/utils/studentAnalytics.js`.
2. **Feature Colocation:** When creating a new section, place it inside its domain folder (`src/components/home/`, `src/components/leaderboard/`, or `src/components/profile/`).
3. **Design System Consistency:** All pages must adhere to the `#fbfaf8` light editorial aesthetic, using `Playfair Display` serif for editorial headers and `Inter` for UI typography.
4. **Testing:** Whenever modifying data transformations in `studentAnalytics.js`, run `npm test` to verify zero regression across sorting and ranking behaviors.
