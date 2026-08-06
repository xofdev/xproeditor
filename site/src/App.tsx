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
      <Nav />
      <Hero />
      <LiveDemo />
      <UseCases />
      <BlocksShowcase />
      <Features />
      <InstallTabs />
      <Packages />
      <Footer />
    </div>
  )
}
