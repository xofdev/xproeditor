import { Features } from './components/Features'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { InstallTabs } from './components/InstallTabs'
import { LiveDemo } from './components/LiveDemo'
import { Nav } from './components/Nav'
import { Packages } from './components/Packages'

export default function App() {
  return (
    <div className="site">
      <Nav />
      <Hero />
      <LiveDemo />
      <InstallTabs />
      <Features />
      <Packages />
      <Footer />
    </div>
  )
}
