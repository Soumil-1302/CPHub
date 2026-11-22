/**
 * ResourceCard — Reusable card component for a single learning resource.
 *
 * Renders title, description, category pill, difficulty badge, platform,
 * and an external "Explore Resource" link. Follows CPHub editorial styling.
 */

const DIFFICULTY_COLORS = {
  beginner: { bg: 'rgba(34,197,94,0.10)', text: '#16a34a', border: 'rgba(34,197,94,0.25)' },
  intermediate: { bg: 'rgba(234,179,8,0.10)', text: '#b45309', border: 'rgba(234,179,8,0.25)' },
  advanced: { bg: 'rgba(239,68,68,0.10)', text: '#dc2626', border: 'rgba(239,68,68,0.25)' },
}

const CATEGORY_LABELS = {
  'dsa-learning': 'DSA Learning',
  'competitive-programming': 'Competitive Programming',
  'practice-platforms': 'Practice Platform',
  'learning-roadmaps': 'Learning Roadmap',
  'useful-tools': 'Useful Tool',
}

const PLATFORM_ICONS = {
  GeeksforGeeks: '📗',
  CSES: '📘',
  'CP Algorithms': '📙',
  USACO: '🐄',
  AtCoder: '🏯',
  LeetCode: '💡',
  HackerRank: '💚',
  NeetCode: '🎯',
  VisuAlgo: '🎨',
  TIO: '🖥️',
  Regex101: '🔍',
  GitHub: '🐙',
  'CP Editor': '✏️',
}

export default function ResourceCard({ resource, style }) {
  const diffColors = resource.difficulty ? DIFFICULTY_COLORS[resource.difficulty] : null
  const categoryLabel = CATEGORY_LABELS[resource.category] || resource.category
  const platformIcon = PLATFORM_ICONS[resource.platform] || '🔗'

  return (
    <article className="resource-card" style={style}>
      {/* Card header row: category + difficulty */}
      <div className="resource-card-header">
        <span className="resource-category-pill">{categoryLabel}</span>
        {resource.difficulty && diffColors && (
          <span
            className="resource-difficulty-badge"
            style={{
              background: diffColors.bg,
              color: diffColors.text,
              borderColor: diffColors.border,
            }}
          >
            {resource.difficulty.charAt(0).toUpperCase() + resource.difficulty.slice(1)}
          </span>
        )}
      </div>

      {/* Platform + Title */}
      <div className="resource-title-row">
        <span className="resource-platform-icon" aria-hidden="true">
          {platformIcon}
        </span>
        <h3 className="resource-title">{resource.title}</h3>
      </div>

      {/* Description */}
      <p className="resource-description">{resource.description}</p>

      {/* Footer: platform name + explore link */}
      <div className="resource-card-footer">
        <span className="resource-platform-name">{resource.platform}</span>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="resource-explore-link"
        >
          <span>Explore Resource</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      </div>

      {/* Featured badge */}
      {resource.featured && (
        <div className="resource-featured-badge" aria-label="Featured resource">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
          </svg>
        </div>
      )}
    </article>
  )
}
