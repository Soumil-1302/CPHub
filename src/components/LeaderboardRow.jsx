export default function LeaderboardRow({ student }) {
  const { rank, username, name, branchDisplay, leetcode, codeforces, total } = student;

  const rankBadgeClass =
    rank === 1
      ? 'rank-badge rank-badge--1'
      : rank === 2
      ? 'rank-badge rank-badge--2'
      : rank === 3
      ? 'rank-badge rank-badge--3'
      : 'rank-badge rank-badge--other';

  const rowRankClass = rank <= 3 ? `row-rank-${rank}` : '';

  return (
    <tr className={rowRankClass}>
      {/* 1. Rank */}
      <td className="rank-cell">
        <span className={rankBadgeClass} aria-label={`Rank ${rank}`}>
          {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
        </span>
      </td>

      {/* 2. Username */}
      <td className="username-cell">
        <span className="username-tag">@{username}</span>
      </td>

      {/* 3. Name */}
      <td className="name-cell">
        <span>{name}</span>
      </td>

      {/* 4. Branch */}
      <td className="branch-cell">
        <span className="branch-badge">{branchDisplay}</span>
      </td>

      {/* 5. LeetCode problems solved */}
      <td className="platform-stat-cell">
        <div className="platform-stat" title={`LeetCode: ${leetcode} solved`}>
          <img
            src="/lc.jpeg"
            alt="LeetCode"
            className="platform-icon"
            width="20"
            height="20"
            loading="lazy"
          />
          <span>{leetcode.toLocaleString()}</span>
        </div>
      </td>

      {/* 6. Codeforces problems solved */}
      <td className="platform-stat-cell">
        <div className="platform-stat" title={`Codeforces: ${codeforces} solved`}>
          <img
            src="/cf.jpeg"
            alt="Codeforces"
            className="platform-icon"
            width="20"
            height="20"
            loading="lazy"
          />
          <span>{codeforces.toLocaleString()}</span>
        </div>
      </td>

      {/* 7. Total questions solved */}
      <td className="total-stat-cell">
        <span className="total-stat" title={`Total: ${total} problems solved`}>
          {total.toLocaleString()}
        </span>
      </td>
    </tr>
  )
}
