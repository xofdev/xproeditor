import { useEffect, useState } from 'react'

const REPO_URL = 'https://github.com/xofdev/xproeditor'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
      </nav>
    </header>
  )
}
