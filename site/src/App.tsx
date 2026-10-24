import { BlocksShowcase } from './components/BlocksShowcase'
import { Changelog } from './components/Changelog'
import { Collaboration } from './components/Collaboration'
import { FAQ } from './components/FAQ'
import { Features } from './components/Features'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { InstallTabs } from './components/InstallTabs'
import { LiveDemo } from './components/LiveDemo'
import { Nav } from './components/Nav'
import { Packages } from './components/Packages'
import { UseCases } from './components/UseCases'

export default function App() {
  return (
    <div className="site">
      <a className="skip-link" href="#demo">
        Skip to live demo
      </a>
      <Nav />
      <main>
        <Hero />
        <LiveDemo />
        <Collaboration />
        <Features />
        <UseCases />
        <BlocksShowcase />
        <InstallTabs />
        <Packages />
        <FAQ />
        <Changelog />
      </main>
      <Footer />
    </div>
  )
}
