import { Features } from './components/Features'
import { BlocksShowcase } from './components/BlocksShowcase'
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
        <UseCases />
        <BlocksShowcase />
        <Features />
        <InstallTabs />
        <Packages />
      </main>
      <Footer />
    </div>
  )
}
