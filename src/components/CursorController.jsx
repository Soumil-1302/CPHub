import { useState } from 'react'

export default function CursorController({
  active,
  onToggle,
  color,
  onChangeColor,
  glow,
  onToggleGlow,
}) {
  const [openSettings, setOpenSettings] = useState(false)

  const colorPresets = [
    { label: 'CPHub Red', hex: '#10a09cff' },
    { label: 'Originkit Blue', hex: '#4C8DFF' },
    { label: 'Clean White', hex: '#FFFFFF' },
    { label: 'Neon Emerald', hex: '#10b981' },
    { label: 'Violet Glow', hex: '#a855f7' },
  ]

  return (
    <aside className="spin-cursor-dock" aria-label="Cursor Controls">
      {openSettings && (
        <div className="spin-cursor-panel" role="dialog" aria-label="Cursor Settings">
          <div className="spin-cursor-panel-header">
            <span>Spin Cursor Settings</span>
            <button
              className="spin-cursor-settings-btn"
              onClick={() => setOpenSettings(false)}
              aria-label="Close settings"
              style={{ width: '20px', height: '20px', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>

          <div className="spin-cursor-panel-section">
            <span className="spin-cursor-panel-label">Arrow Accent</span>
            <div className="spin-cursor-color-row">
              {colorPresets.map((c) => (
                <button
                  key={c.hex}
                  className={`spin-cursor-color-chip ${color.toLowerCase() === c.hex.toLowerCase() ? 'selected' : ''}`}
                  style={{ backgroundColor: c.hex, color: c.hex }}
                  onClick={() => onChangeColor(c.hex)}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          <div className="spin-cursor-panel-section">
            <div className="spin-cursor-toggle-row">
              <span>Glow Bloom</span>
              <button
                type="button"
                className={`spin-cursor-switch ${glow ? 'on' : ''}`}
                onClick={onToggleGlow}
                aria-label="Toggle glow"
              >
                <div className="spin-cursor-switch-knob" />
              </button>
            </div>
          </div>

          <div className="spin-cursor-panel-section">
            <div className="spin-cursor-toggle-row">
              <span>Enable Cursor</span>
              <button
                type="button"
                className={`spin-cursor-switch ${active ? 'on' : ''}`}
                onClick={onToggle}
                aria-label="Toggle cursor"
              >
                <div className="spin-cursor-switch-knob" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="spin-cursor-pill">
        <span
          className={`spin-cursor-status-dot ${active ? 'active' : 'inactive'}`}
          aria-hidden="true"
        />
        <button
          className="spin-cursor-toggle-btn"
          onClick={onToggle}
          title={active ? 'Click to disable Spin Cursor' : 'Click to enable Spin Cursor'}
        >
          <span>Spin Cursor</span>
          <span style={{ opacity: 0.65, fontSize: '11px', textTransform: 'uppercase' }}>
            {active ? 'ON' : 'OFF'}
          </span>
        </button>
        <button
          className="spin-cursor-settings-btn"
          onClick={() => setOpenSettings((prev) => !prev)}
          title="Cursor Settings"
          aria-label="Cursor Settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
