import { useEffect, useState } from 'react'
import { Github, Menu, X } from 'lucide-react'
import { currentTheme, transitionTheme, type SiteTheme } from '../theme'

const REPO_URL = 'https://github.com/xofdev/xproeditor'

const LINKS = [
  { href: '#demo', label: 'Demo' },
  { href: '#collaborate', label: 'Collaborate' },
  { href: '#features', label: 'Features' },
  { href: '#blocks', label: 'Blocks' },
  { href: '#install', label: 'Install' },
  { href: '#faq', label: 'FAQ' },
]

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  // The real theme is applied by an inline script in index.html before
  // paint; read it after hydration so the prerendered markup stays stable.
  const [theme, setTheme] = useState<SiteTheme>('light')

  useEffect(() => setTheme(currentTheme()), [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    transitionTheme(next)
  }

  const themeLabel = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}${open ? ' open' : ''}`}>
      <div className="nav-inner">
        <a className="nav-brand" href="#top" aria-label="XProEditor home">
          <span className="nav-brand-mark" aria-hidden>
            X
          </span>
          <span>XProEditor</span>
        </a>

        <nav className="nav-links" id="nav-links" aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.href} className="nav-link" href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="nav-link" href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer">
            Docs
          </a>
        </nav>

        <div className="nav-actions">
          <button type="button" className="icon-btn" title={themeLabel} aria-label={themeLabel} onClick={toggleTheme}>
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <a className="btn btn-primary btn-sm nav-github" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={15} aria-hidden />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            className="icon-btn nav-menu-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="nav-links"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
