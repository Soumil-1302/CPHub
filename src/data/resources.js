/**
 * CPHub Learning Resources Data
 *
 * Structured resource data for the Resources page.
 * Each resource has: id, title, description, category, difficulty,
 * url, platform, featured flag, and dateAdded.
 */

export const RESOURCE_CATEGORIES = [
  { id: 'all', label: 'All Resources', icon: 'grid' },
  { id: 'dsa-learning', label: 'DSA Learning', icon: 'book' },
  { id: 'competitive-programming', label: 'Competitive Programming', icon: 'trophy' },
  { id: 'practice-platforms', label: 'Practice Platforms', icon: 'code' },
  { id: 'learning-roadmaps', label: 'Learning Roadmaps', icon: 'map' },
  { id: 'useful-tools', label: 'Useful Tools', icon: 'tool' },
]

export const DIFFICULTY_LEVELS = [
  { id: 'all', label: 'All Levels' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

export const RESOURCES = [
  // ──────────────────────────────────────────
  // DSA Learning
  // ──────────────────────────────────────────
  {
    id: 'dsa-arrays-strings',
    title: 'Arrays and Strings',
    description:
      'Master fundamental array manipulation, two-pointer techniques, sliding windows, and string processing patterns used across all competitive programming.',
    category: 'dsa-learning',
    difficulty: 'beginner',
    url: 'https://www.geeksforgeeks.org/array-data-structure/',
    platform: 'GeeksforGeeks',
    featured: true,
    dateAdded: '2026-10-15',
  },
  {
    id: 'dsa-linked-lists',
    title: 'Linked Lists',
    description:
      'Understand singly and doubly linked lists, cycle detection, reversal algorithms, and merge techniques essential for interviews and contests.',
    category: 'dsa-learning',
    difficulty: 'beginner',
    url: 'https://www.geeksforgeeks.org/data-structures/linked-list/',
    platform: 'GeeksforGeeks',
    featured: false,
    dateAdded: '2026-10-12',
  },
  {
    id: 'dsa-stacks-queues',
    title: 'Stacks and Queues',
    description:
      'Learn stack-based expression evaluation, monotonic stacks, queue implementations with deques, and BFS-ready queue patterns.',
    category: 'dsa-learning',
    difficulty: 'beginner',
    url: 'https://www.geeksforgeeks.org/stack-data-structure/',
    platform: 'GeeksforGeeks',
    featured: false,
    dateAdded: '2026-10-10',
  },
  {
    id: 'dsa-trees-graphs',
    title: 'Trees and Graphs',
    description:
      'Explore binary trees, BSTs, graph traversals (BFS/DFS), shortest paths, spanning trees, and topological sorting with structured tutorials.',
    category: 'dsa-learning',
    difficulty: 'intermediate',
    url: 'https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/',
    platform: 'GeeksforGeeks',
    featured: true,
    dateAdded: '2026-10-18',
  },
  {
    id: 'dsa-dynamic-programming',
    title: 'Dynamic Programming',
    description:
      'Build intuition for DP through memoization, tabulation, state transitions, and classic problems like knapsack, LIS, and edit distance.',
    category: 'dsa-learning',
    difficulty: 'intermediate',
    url: 'https://www.geeksforgeeks.org/dynamic-programming/',
    platform: 'GeeksforGeeks',
    featured: true,
    dateAdded: '2026-10-20',
  },
  {
    id: 'dsa-greedy',
    title: 'Greedy Algorithms',
    description:
      'Study greedy strategies including activity selection, Huffman coding, interval scheduling, and when greedy is provably optimal.',
    category: 'dsa-learning',
    difficulty: 'intermediate',
    url: 'https://www.geeksforgeeks.org/greedy-algorithms/',
    platform: 'GeeksforGeeks',
    featured: false,
    dateAdded: '2026-10-08',
  },
  {
    id: 'dsa-recursion-backtracking',
    title: 'Recursion and Backtracking',
    description:
      'Develop problem-solving skills with recursive thinking, backtracking frameworks, permutation/combination generation, and constraint-based search.',
    category: 'dsa-learning',
    difficulty: 'intermediate',
    url: 'https://www.geeksforgeeks.org/backtracking-algorithms/',
    platform: 'GeeksforGeeks',
    featured: false,
    dateAdded: '2026-10-05',
  },
  {
    id: 'dsa-sorting-searching',
    title: 'Sorting and Searching',
    description:
      'Compare sorting algorithms (merge, quick, heap, counting), binary search variations, and search patterns for competitive programming.',
    category: 'dsa-learning',
    difficulty: 'beginner',
    url: 'https://www.geeksforgeeks.org/sorting-algorithms/',
    platform: 'GeeksforGeeks',
    featured: false,
    dateAdded: '2026-10-03',
  },

  // ──────────────────────────────────────────
  // Competitive Programming
  // ──────────────────────────────────────────
  {
    id: 'cp-handbook',
    title: 'Competitive Programming Handbook',
    description:
      'Antti Laaksonen\'s comprehensive free book covering all essential CP topics from basic techniques to advanced algorithms and mathematics.',
    category: 'competitive-programming',
    difficulty: 'intermediate',
    url: 'https://cses.fi/book/book.pdf',
    platform: 'CSES',
    featured: true,
    dateAdded: '2026-10-22',
  },
  {
    id: 'cp-algorithms',
    title: 'CP Algorithms',
    description:
      'An extensive collection of algorithm and data structure explanations with C++ implementations, translated from the renowned Russian e-maxx resource.',
    category: 'competitive-programming',
    difficulty: 'advanced',
    url: 'https://cp-algorithms.com/',
    platform: 'CP Algorithms',
    featured: true,
    dateAdded: '2026-10-25',
  },
  {
    id: 'cf-problemsets',
    title: 'Codeforces Problemsets',
    description:
      'Access thousands of curated competitive programming problems sorted by rating, tags, and contest origin on the world\'s largest CP platform.',
    category: 'competitive-programming',
    difficulty: 'intermediate',
    url: 'https://codeforces.com/problemset',
    platform: 'Codeforces',
    featured: false,
    dateAdded: '2026-10-14',
  },
  {
    id: 'usaco-guide',
    title: 'USACO Guide',
    description:
      'A structured, free curriculum designed around USACO divisions — Bronze through Platinum — with curated problems and detailed editorials.',
    category: 'competitive-programming',
    difficulty: 'intermediate',
    url: 'https://usaco.guide/',
    platform: 'USACO',
    featured: true,
    dateAdded: '2026-10-28',
  },
  {
    id: 'cses-problemset',
    title: 'CSES Problem Set',
    description:
      'A carefully structured collection of 300 classic problems covering every standard algorithm and data structure topic in competitive programming.',
    category: 'competitive-programming',
    difficulty: 'intermediate',
    url: 'https://cses.fi/problemset/',
    platform: 'CSES',
    featured: false,
    dateAdded: '2026-10-11',
  },
  {
    id: 'atcoder-educational',
    title: 'AtCoder Educational Resources',
    description:
      'AtCoder\'s educational contests and DP contest series provide structured learning paths for both beginners and experienced competitive programmers.',
    category: 'competitive-programming',
    difficulty: 'intermediate',
    url: 'https://atcoder.jp/contests/dp',
    platform: 'AtCoder',
    featured: false,
    dateAdded: '2026-10-09',
  },

  // ──────────────────────────────────────────
  // Practice Platforms
  // ──────────────────────────────────────────
  {
    id: 'platform-leetcode',
    title: 'LeetCode',
    description:
      'The industry standard for technical interview preparation with 2800+ problems, weekly contests, company-tagged questions, and discussion forums.',
    category: 'practice-platforms',
    difficulty: 'beginner',
    url: 'https://leetcode.com/',
    platform: 'LeetCode',
    featured: true,
    dateAdded: '2026-10-30',
  },
  {
    id: 'platform-codeforces',
    title: 'Codeforces',
    description:
      'The largest competitive programming platform with regular contests, a robust rating system, problem archive, and active community blogs.',
    category: 'practice-platforms',
    difficulty: 'intermediate',
    url: 'https://codeforces.com/',
    platform: 'Codeforces',
    featured: true,
    dateAdded: '2026-10-29',
  },
  {
    id: 'platform-atcoder',
    title: 'AtCoder',
    description:
      'A Japanese competitive programming platform known for high-quality problems, ABC/ARC/AGC contest tiers, and elegant mathematical challenges.',
    category: 'practice-platforms',
    difficulty: 'intermediate',
    url: 'https://atcoder.jp/',
    platform: 'AtCoder',
    featured: false,
    dateAdded: '2026-10-07',
  },
  {
    id: 'platform-hackerrank',
    title: 'HackerRank',
    description:
      'Practice coding across multiple domains including algorithms, data structures, SQL, and AI with skill certifications and company challenges.',
    category: 'practice-platforms',
    difficulty: 'beginner',
    url: 'https://www.hackerrank.com/',
    platform: 'HackerRank',
    featured: false,
    dateAdded: '2026-10-04',
  },
  {
    id: 'platform-cses',
    title: 'CSES',
    description:
      'A Finnish online judge with a well-known problem set designed to systematically cover the core topics of competitive programming.',
    category: 'practice-platforms',
    difficulty: 'intermediate',
    url: 'https://cses.fi/',
    platform: 'CSES',
    featured: false,
    dateAdded: '2026-10-02',
  },

  // ──────────────────────────────────────────
  // Learning Roadmaps
  // ──────────────────────────────────────────
  {
    id: 'roadmap-beginner',
    title: 'Beginner DSA Roadmap',
    description:
      'Start your DSA journey with this structured path covering arrays, strings, basic sorting, searching, and elementary data structures.',
    category: 'learning-roadmaps',
    difficulty: 'beginner',
    url: 'https://neetcode.io/roadmap',
    platform: 'NeetCode',
    featured: true,
    dateAdded: '2026-10-26',
  },
  {
    id: 'roadmap-intermediate',
    title: 'Intermediate DSA Roadmap',
    description:
      'Progress through trees, graphs, dynamic programming, advanced data structures, and medium-difficulty interview-style problems.',
    category: 'learning-roadmaps',
    difficulty: 'intermediate',
    url: 'https://neetcode.io/roadmap',
    platform: 'NeetCode',
    featured: false,
    dateAdded: '2026-10-16',
  },
  {
    id: 'roadmap-advanced-cp',
    title: 'Advanced Competitive Programming Roadmap',
    description:
      'Tackle advanced topics: segment trees, heavy-light decomposition, FFT, flows, advanced DP optimizations, and competitive math.',
    category: 'learning-roadmaps',
    difficulty: 'advanced',
    url: 'https://codeforces.com/blog/entry/111099',
    platform: 'Codeforces',
    featured: false,
    dateAdded: '2026-10-13',
  },
  {
    id: 'roadmap-interview-prep',
    title: 'Interview Preparation Roadmap',
    description:
      'A focused roadmap for technical interviews covering the most frequently asked patterns, system design basics, and company-specific prep.',
    category: 'learning-roadmaps',
    difficulty: 'intermediate',
    url: 'https://neetcode.io/practice',
    platform: 'NeetCode',
    featured: true,
    dateAdded: '2026-10-24',
  },

  // ──────────────────────────────────────────
  // Useful Tools
  // ──────────────────────────────────────────
  {
    id: 'tool-visualgo',
    title: 'VisuAlgo',
    description:
      'Visualise data structures and algorithms through animated, interactive step-by-step demonstrations — perfect for building intuition.',
    category: 'useful-tools',
    url: 'https://visualgo.net/',
    platform: 'VisuAlgo',
    featured: true,
    dateAdded: '2026-10-27',
  },
  {
    id: 'tool-tio',
    title: 'TIO — Try It Online',
    description:
      'Run code in 680+ programming languages directly in your browser. Perfect for quickly testing algorithm implementations without local setup.',
    category: 'useful-tools',
    url: 'https://tio.run/',
    platform: 'TIO',
    featured: false,
    dateAdded: '2026-10-06',
  },
  {
    id: 'tool-regex101',
    title: 'Regex101',
    description:
      'Build, test, and debug regular expressions with real-time explanation, match highlighting, and a community pattern library.',
    category: 'useful-tools',
    url: 'https://regex101.com/',
    platform: 'Regex101',
    featured: false,
    dateAdded: '2026-10-01',
  },
  {
    id: 'tool-github',
    title: 'GitHub',
    description:
      'Host your competitive programming solutions, collaborate on open-source algorithm libraries, and explore curated DSA repositories.',
    category: 'useful-tools',
    url: 'https://github.com/',
    platform: 'GitHub',
    featured: false,
    dateAdded: '2026-09-28',
  },
  {
    id: 'tool-cp-editor',
    title: 'CP Editor',
    description:
      'A dedicated code editor for competitive programming with built-in test case management, checker integration, and contest companion support.',
    category: 'useful-tools',
    url: 'https://cpeditor.org/',
    platform: 'CP Editor',
    featured: false,
    dateAdded: '2026-09-25',
  },
]

