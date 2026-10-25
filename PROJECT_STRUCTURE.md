# Architecture & Codebase Structure

This document provides a comprehensive overview of the design patterns, architectural decisions, and directory layout implemented in the **CPHub Frontend** codebase.

---

## 1. Directory Structure & Responsibilities

| Directory | Primary Responsibility | Notes |
| :--- | :--- | :--- |
| `src/constants/` | Global immutable values, route paths, navigation links | Prevents magic strings across routing and navigation (`routes.js`). |
| `src/data/` | Static JSON data sources | Contains `students.json` (100 students) and `branches.json`. |
| `src/services/` | External API integrations & network requests | Centralizes network logic (e.g. `authService.js`). |
| `src/utils/` | Pure business logic, data calculations, algorithms | Fully testable, framework-independent functions with unit test suite. |
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

### 2.1 Student Data Normalization, Ranking & Profile Analytics (`src/utils/studentAnalytics.js`)

Centralized, zero-dependency business logic functions:

- **`normalizeStudentsData(rawData)`**: Normalizes both array-based and object-keyed USN representations into a standardized student array.
- **`resolveBranchName(branchVal, branchMap)`**: Maps department codes (`ct`, `cs`, `am`, etc.) to official branch names (`CST`, `CSE`, `AI&ML`, etc.).
- **`getBranchList(branchesData)`**: Extracts the unique set of active university engineering departments.
- **`getYearOptions(studentsList)`**: Determines distinct student graduation cohorts, sorted descending.
- **`calculateCampusStats(studentsList, branchMap)`**: Computes aggregated campus statistics (total students, total solved, platform breakdown, active department counts).
- **`processLeaderboardStudents(studentsList, filters, branchMap)`**: Executes multi-criteria filtering (department, batch year, search query), safe calculation of solve counts, tie-breaking sorting (Total $\rightarrow$ LeetCode $\rightarrow$ Codeforces $\rightarrow$ Name), and dynamic 1-based rank assignment.
- **`getStudentByIdentifier(studentsList, identifier)`**: Resolves a student by username or USN case-insensitively.
- **`computeStudentProfileData(student, studentsList, branchMap)`**: Computes overall campus rank, department rank, cohort/batch rank, LeetCode difficulty breakdown (Easy, Medium, Hard), Codeforces title tier & rating estimate, solving ratios, and earned campus honor badges.

### 2.2 Navigation & Routing Architecture (`src/constants/routes.js`)

Route paths are centrally declared in `ROUTES`:

```javascript
export const ROUTES = {
  HOME: '/',
  HOME_ALIAS: '/home',
  LOGIN: '/login',
  SIGNIN: '/signin',
  LEADERBOARD: '/leaderboard',
  PROFILE_BASE: '/profile',
  profile: (username) => `/profile/${encodeURIComponent(username || '')}`,
  DASHBOARD: '/dashboard',
  CONTESTS: '/contests',
  RANKINGS: '/rankings',
}
```

Dynamic route patterns in `App.jsx` parse direct URLs such as `/profile/:username` and route gracefully to `Profile.jsx`.

### 2.3 Page Implementations

1. **Sign In (`/login` & `/signin` via `src/pages/Login.jsx` & `src/styles/auth.css`)**:
   - University credentials and magic link tabs.
   - Live university email domain verification (`@dsu.edu.in` and `.edu` domains).
   - Instant department and batch detection badge from USN format.
   - Show/hide password toggle and client validation messages.
   - Quick demo student fill chips (Aarav Sharma, Ananya Rao).
   - Simulated LDAP verification notice with instant action buttons.

2. **Leaderboard (`/leaderboard` via `src/pages/Leaderboard.jsx` & `src/styles/leaderboard.css`)**:
   - Header with active students count, total solved, LeetCode / Codeforces sums, and active departments.
   - Top 3 podium showcase cards (🥇 1st Place, 🥈 2nd Place, 🥉 3rd Place) with direct profile links.
   - Filter bar with search by coder handle, student name, or USN; department dropdown; graduation batch dropdown; metric sort selection; sort order toggle; and reset button.
   - Responsive table displaying Rank, Username, Student Name & USN, Department, LeetCode solves with logo, Codeforces solves with logo, Total Solved with progress bar, and row-click navigation to profile.
   - Efficient client pagination (20 per page) with page number controls.

3. **Individual User Profile (`/profile/:username` via `src/pages/Profile.jsx` & `src/styles/profile.css`)**:
   - Header with back-to-leaderboard button, initials avatar, official campus rank badge, student name, `@username`, USN, Dayananda Sagar University affiliation, department, and batch tags.
   - Quick stats grid: Overall campus rank, Department rank, Cohort batch rank, Total Solved across platforms.
   - Dedicated LeetCode card: verified solve count, stacked difficulty bar, Easy/Medium/Hard counts, and external link.
   - Dedicated Codeforces card: verified solve count, rating status, title category badge (Specialist, Expert, Pupil), and external link.
   - Benchmark card: Platform solving balance (LeetCode % vs Codeforces %), top percentile badge, and earned campus milestone badges.
   - Graceful 404 / Missing student state with suggestions for top campus leaders.

---

## 3. Maintenance Rules for Developers

1. **Keep Page Components Lean:** Page components (`src/pages/*`) should serve as orchestrators connecting layout, state, and feature sections. Do not embed raw data processing in pages; use `src/utils/studentAnalytics.js`.
2. **Feature Colocation:** When creating a new section, place it inside its domain folder (`src/components/home/`, `src/components/leaderboard/`, or `src/components/profile/`).
3. **Design System Consistency:** All pages must adhere to the `#fbfaf8` light editorial aesthetic, using `Playfair Display` serif for editorial headers and `Inter` for UI typography.
4. **Testing:** Whenever modifying data transformations in `studentAnalytics.js`, run `npm test` to verify zero regression across sorting and ranking behaviors.
