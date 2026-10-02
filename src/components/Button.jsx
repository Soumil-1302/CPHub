import '../styles/button.css'

export default function Button({ children, variant = 'primary', onClick, className = '' }) {
  return (
    <button
      className={`cpb-button cpb-button--${variant} ${className}`}
      onClick={onClick}
      aria-haspopup={variant === 'menu' ? 'true' : 'false'}
    >
      {children}
    </button>
  )
}
