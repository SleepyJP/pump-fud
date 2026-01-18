import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { AdCarousel } from './components/AdCarousel'
import { StainedGlassPanel } from './components/StainedGlassPanel'
import { HomePage } from './pages/HomePage'
import { TokenPage } from './pages/TokenPage'
import { TokenDashboard } from './pages/TokenDashboard'
import { LaunchPage } from './pages/LaunchPage'
import { SwapPage } from './pages/SwapPage'
import { LivestreamsPage } from './pages/LivestreamsPage'
import { LiveChatPopup } from './pages/LiveChatPopup'
import { MessageBoardPopup } from './pages/MessageBoardPopup'

// Full-bleed routes don't show sidebar/chrome
const FULL_BLEED_ROUTES = ['/', '/launch', '/live-chat', '/message-board']

// Dashboard routes are also full-bleed but need pattern matching
const isDashboardRoute = (pathname: string) => pathname.startsWith('/dashboard/')

function AppContent() {
  const location = useLocation()
  const isFullBleed = FULL_BLEED_ROUTES.includes(location.pathname) || isDashboardRoute(location.pathname)

  // Full-bleed pages render without chrome
  if (isFullBleed) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#020203',
        color: '#e8e8e8',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/launch" element={<LaunchPage />} />
          <Route path="/dashboard/:tokenId" element={<TokenDashboard />} />
          <Route path="/live-chat" element={<LiveChatPopup />} />
          <Route path="/message-board" element={<MessageBoardPopup />} />
        </Routes>

        {/* CSS Animations for full-bleed pages */}
        <style>{`
          @keyframes floatCard {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
        `}</style>
      </div>
    )
  }

  // Standard layout with sidebar and chrome
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#020203',
      color: '#e8e8e8',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Atmospheric Fog Overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: `
          radial-gradient(ellipse at 0% 50%, rgba(139,0,0,0.08) 0%, transparent 40%),
          radial-gradient(ellipse at 100% 50%, rgba(139,0,0,0.08) 0%, transparent 40%),
          radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.05) 0%, transparent 30%),
          radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 50%)
        `,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Dust Particles Effect */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(255,255,255,0.015) 1px, transparent 1px),
          radial-gradient(circle at 80% 70%, rgba(255,255,255,0.01) 1px, transparent 1px),
          radial-gradient(circle at 40% 80%, rgba(255,255,255,0.012) 1px, transparent 1px),
          radial-gradient(circle at 60% 20%, rgba(255,255,255,0.008) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 150px 150px, 200px 200px, 120px 120px',
        animation: 'dustFloat 60s linear infinite',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Left Sidebar */}
      <Sidebar />

      {/* Left Stained Glass Window */}
      <StainedGlassPanel side="left" />

      {/* Right Stained Glass Window */}
      <StainedGlassPanel side="right" />

      {/* Main Content Area - The Nave */}
      <div style={{
        marginLeft: '240px',
        marginRight: '80px',
        position: 'relative',
        zIndex: 2,
      }}>
        <TopBar />

        <main style={{
          paddingTop: '72px',
          minHeight: '100vh',
          position: 'relative',
        }}>
          {/* Vaulted Ceiling Effect */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: '240px',
            right: '80px',
            height: '150px',
            background: `
              radial-gradient(ellipse 120% 100% at 50% 0%, rgba(20,20,26,0.95) 0%, transparent 70%),
              linear-gradient(180deg, rgba(10,10,12,0.9) 0%, transparent 100%)
            `,
            pointerEvents: 'none',
            zIndex: 10,
          }} />

          {/* Ad Carousel - Prophecy Banner */}
          <div style={{ paddingTop: '20px', position: 'relative', zIndex: 5 }}>
            <AdCarousel />
          </div>

          {/* Stone Floor Pattern Overlay */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: '240px',
            right: '80px',
            height: '100px',
            background: 'linear-gradient(0deg, rgba(10,10,12,0.8) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 5,
          }} />

          <Routes>
            <Route path="/token/:address" element={<TokenPage />} />
            <Route path="/dashboard/:tokenId" element={<TokenDashboard />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/livestreams" element={<LivestreamsPage />} />
            <Route path="/terminal" element={<HomePage />} />
            <Route path="/chat" element={<HomePage />} />
            <Route path="/support" element={<HomePage />} />
          </Routes>
        </main>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes dustFloat {
          0% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-10px) translateX(5px); }
          50% { transform: translateY(0) translateX(10px); }
          75% { transform: translateY(10px) translateX(5px); }
          100% { transform: translateY(0) translateX(0); }
        }

        @keyframes candleFlicker {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
          25%, 75% { opacity: 0.9; }
        }

        @keyframes sparkleFloat {
          0% { transform: translateY(-100%) scaleY(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(0) scaleY(1); }
          90% { opacity: 1; transform: translateY(calc(100vh - 20px)) scaleY(1); }
          100% { transform: translateY(100vh) scaleY(0.5); opacity: 0; }
        }

        @keyframes ghostFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); opacity: 0.8; }
          50% { transform: translateY(-8px) rotate(1deg); opacity: 1; }
        }

        @keyframes hellfireGlow {
          0%, 100% {
            box-shadow: 0 0 5px #8B0000, 0 0 15px #DC143C, inset 0 0 10px rgba(220,20,60,0.3);
          }
          50% {
            box-shadow: 0 0 15px #DC143C, 0 0 30px #FF2400, 0 0 50px rgba(255,36,0,0.4), inset 0 0 20px rgba(220,20,60,0.5);
          }
        }

        @keyframes glassShimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }

        @keyframes eerieGlow {
          0%, 100% { filter: brightness(1) saturate(1); }
          50% { filter: brightness(1.2) saturate(1.3); }
        }
      `}</style>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
