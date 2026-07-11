import { useEffect, useState } from 'react'
import { applyTheme, initialTheme, transitionTheme, type SiteTheme } from '../theme'

const REPO_URL = 'https://github.com/xofdev/xproeditor'

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState<SiteTheme>(() => initialTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    transitionTheme(next)
  }

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`}>
      <a className="nav-brand" href="#top">
        <span className="nav-brand-mark">X</span>
        XProEditor
      </a>
      <nav className="nav-links">
        <a className="nav-link" href="#demo">
          Demo
        </a>
        <a className="nav-link" href="#install">
          Install
        </a>
        <a className="nav-link" href="#packages">
          Packages
        </a>
        <a
          className="nav-link"
          href={`${REPO_URL}/tree/main/docs`}
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
        <a className="nav-link cta" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <button
          type="button"
          className="theme-toggle"
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </nav>
    </header>
  )
}
