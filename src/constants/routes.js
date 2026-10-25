/**
 * Application Route Paths
 */
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

export const NAV_LINKS = [
  { label: 'Home', path: ROUTES.HOME },
  { label: 'Leaderboard', path: ROUTES.LEADERBOARD },
  { label: 'Contests', path: ROUTES.CONTESTS },
  { label: 'Community', path: '#community' },
]
