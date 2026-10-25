import { ROUTES } from '../../constants/routes'

export default function LeaderboardRow({ student, maxTotal = 1200, onNavigate }) {
  const { rank, username, name, usn, branchDisplay, leetcode, codeforces, total } = student

  const isTop1 = rank === 1
  const isTop2 = rank === 2
  const isTop3 = rank === 3

  const rankBadgeClass = isTop1
    ? 'preview-rank-badge preview-rank-1'
    : isTop2
    ? 'preview-rank-badge preview-rank-2'
    : isTop3
    ? 'preview-rank-badge preview-rank-3'
    : 'preview-rank-badge'

  const rankDisplay = isTop1 ? '🥇 1' : isTop2 ? '🥈 2' : isTop3 ? '🥉 3' : rank

  const handleRowClick = () => {
    if (onNavigate) {
      onNavigate(ROUTES.profile(username))
    }
  }

  const handleExternalClick = (e, url) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const progressPercent = Math.min(100, Math.round(((total || 0) / (maxTotal || 1)) * 100))

  return (
    <tr
      className={`leaderboard-tr ${isTop1 ? 'row-first' : ''}`}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      aria-label={`View profile of ${name}, Rank ${rank}`}
    >
      {/* 1. Rank */}
      <td className="cell-rank">
        <span className={rankBadgeClass} aria-label={`Rank ${rank}`}>
          {rankDisplay}
        </span>
      </td>

      {/* 2. Username */}
      <td className="cell-username">
        <div className="student-user-cell">
          <div className="table-avatar" aria-hidden="true">
            {(name || 'S').charAt(0)}
          </div>
          <span className="table-username-tag">@{username}</span>
        </div>
      </td>

      {/* 3. Name */}
      <td className="cell-name">
        <div className="name-block">
          <span className="student-full-name">{name}</span>
          {usn && <span className="student-usn-sub">{usn}</span>}
        </div>
      </td>

      {/* 4. Branch */}
      <td className="cell-branch">
        <span className="preview-branch-tag">{branchDisplay}</span>
      </td>

      {/* 5. LeetCode */}
      <td className="cell-platform">
        <div
          className="platform-cell-link"
          title={`View @${username} on LeetCode`}
          onClick={(e) => handleExternalClick(e, `https://leetcode.com/u/${username}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleExternalClick(e, `https://leetcode.com/u/${username}`)}
        >
          <img
            src="/lc.jpeg"
            alt="LeetCode"
            className="preview-platform-icon"
            width="18"
            height="18"
          />
          <span className="platform-count">{(leetcode || 0).toLocaleString()}</span>
          <span className="external-hint" aria-hidden="true">↗</span>
        </div>
      </td>

      {/* 6. Codeforces */}
      <td className="cell-platform">
        <div
          className="platform-cell-link"
          title={`View @${username} on Codeforces`}
          onClick={(e) => handleExternalClick(e, `https://codeforces.com/profile/${username}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleExternalClick(e, `https://codeforces.com/profile/${username}`)}
        >
          <img
            src="/cf.jpeg"
            alt="Codeforces"
            className="preview-platform-icon"
            width="18"
            height="18"
          />
          <span className="platform-count">{(codeforces || 0).toLocaleString()}</span>
          <span className="external-hint" aria-hidden="true">↗</span>
        </div>
      </td>

      {/* 7. Total Questions Solved */}
      <td className="cell-total">
        <div className="total-cell-wrap">
          <span className="preview-total-badge">{(total || 0).toLocaleString()}</span>
          <div className="total-progress-track" aria-hidden="true">
            <div
              className="total-progress-bar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </td>
    </tr>
  )
}
