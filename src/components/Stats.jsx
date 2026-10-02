import '../styles/stats.css'

export default function Stats({ items = [] }) {
  const data = items.length ? items : [
    { value: '0', label: 'Users' },
    { value: '0', label: 'Profiles' },
    { value: '0', label: 'Solved' },
  ]

  return (
    <div className="cpb-stats">
      {data.map((d, i) => (
        <div key={i} className="cpb-stat">
          <div className="cpb-stat__num">{d.value}</div>
          <div className="cpb-stat__label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

 