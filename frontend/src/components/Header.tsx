import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Header() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-pump-dark/80 border-b border-pump-green/20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo - Neon Pill */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <img 
              src="/images/pump-pill-neon.png" 
              alt="PUMP.FUD" 
              className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(0,255,0,0.6)] group-hover:drop-shadow-[0_0_20px_rgba(0,255,0,0.8)] transition-all duration-300"
            />
            {/* Glow effect */}
            <div className="absolute inset-0 bg-pump-green/20 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition-opacity" />
          </div>
          <div className="flex flex-col">
            <span 
              className="font-display text-2xl font-black tracking-wider"
              style={{
                color: '#00ff00',
                textShadow: '0 0 10px rgba(0,255,0,0.8), 0 0 20px rgba(0,255,0,0.6), 0 0 30px rgba(0,255,0,0.4)',
              }}
            >
              PUMP.FUD
            </span>
            <span className="text-[10px] text-pump-green/80 uppercase tracking-widest">PulseChain</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive('/')
                ? 'bg-pump-green/20 text-pump-green shadow-[0_0_10px_rgba(0,255,0,0.3)]'
                : 'text-pump-white-muted hover:text-pump-green hover:bg-pump-green/10'
            }`}
          >
            Tokens
          </Link>
          <Link
            to="/launch"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive('/launch')
                ? 'bg-pump-green/20 text-pump-green shadow-[0_0_10px_rgba(0,255,0,0.3)]'
                : 'text-pump-white-muted hover:text-pump-green hover:bg-pump-green/10'
            }`}
          >
            Launch
          </Link>
          <Link
            to="/leaderboard"
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              isActive('/leaderboard')
                ? 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : 'text-pump-white-muted hover:text-yellow-400 hover:bg-yellow-500/10'
            }`}
          >
            <span>👑</span>
            Leaderboard
          </Link>
          <a
            href="https://scan.pulsechain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg font-medium text-pump-white-muted hover:text-pump-green hover:bg-pump-green/10 transition-all"
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
