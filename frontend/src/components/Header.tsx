import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Header() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-pump-dark/80 border-b border-pump-dark-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pump-green to-pump-green-dark flex items-center justify-center shadow-neon">
            <span className="text-pump-dark font-display font-black text-lg">P</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl font-black neon-text tracking-wider">PUMP.FUD</span>
            <span className="text-[10px] text-pump-green uppercase tracking-widest">PulseChain</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive('/')
                ? 'bg-pump-green/20 text-pump-green'
                : 'text-pump-white-muted hover:text-white hover:bg-pump-dark-lighter'
            }`}
          >
            Tokens
          </Link>
          <Link
            to="/launch"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive('/launch')
                ? 'bg-pump-green/20 text-pump-green'
                : 'text-pump-white-muted hover:text-white hover:bg-pump-dark-lighter'
            }`}
          >
            Launch
          </Link>
          <a
            href="https://scan.pulsechain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg font-medium text-pump-white-muted hover:text-white hover:bg-pump-dark-lighter transition-all"
          >
            Explorer
          </a>
        </nav>

        {/* Connect Button */}
        <ConnectButton />
      </div>
    </header>
  )
}
