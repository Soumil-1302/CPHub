# CPHub Frontend

**CPHub** is the competitive programming community platform for Dayananda Sagar University (DSU). It aggregates, analyzes, and ranks student problem-solving velocity across LeetCode and Codeforces, providing real-time leaderboards, batch breakdowns, and campus milestone highlights.

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
│   ├── cf.jpeg                  # Codeforces logo
│   ├── lc.jpeg                  # LeetCode logo
│   ├── favicon2.png             # App favicon
│   └── icons.svg                # Shared SVG icons
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
    │   └── students.json        # Normalized student contest data
    │
    ├── services/                # API communication and external integrations
    │   └── authService.js       # University email magic-link auth service
    │
    ├── utils/                   # Pure business logic and analytics helpers
    │   ├── studentAnalytics.js  # Data parsing, ranking algorithms, campus stats
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

---

## 🏛 Key Architectural Decisions

1. **Separation of Concerns:** Component files only handle presentation and local user events. Business logic (data normalization, branch resolution, ranking tie-breakers, campus summary math) is isolated in pure, testable functions in `src/utils/studentAnalytics.js`.
2. **Domain-Grouped Components:** Reusable components are organized by functional domain (`layout/`, `home/`, `leaderboard/`, `cursor/`, `common/`) rather than an unstructured flat folder.
3. **Dead Code Elimination:** Outdated boilerplate and orphan mock components (`Hero.jsx`, `Stats.jsx`, `Button.jsx`, `hero.css`, `stats.css`, `button.css`, `react.svg`) have been pruned to reduce bundle size and developer cognitive load.
4. **Resilient Data Layer:** `normalizeStudentsData` transparently handles both JSON arrays and object maps keyed by student USN, avoiding runtime type errors when backend data formats vary.
