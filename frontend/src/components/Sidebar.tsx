import { Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Sidebar() {
  const location = useLocation()
  const { isConnected } = useAccount()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', icon: '🏰', label: 'Realm' },
    { path: '/livestreams', icon: '👁️', label: 'Visions' },
    { path: '/terminal', icon: '📜', label: 'Terminal' },
    { path: '/swap', icon: '✨', label: 'Token Swap' },
    { path: '/chat', icon: '💬', label: 'Whispers' },
    { path: '/support', icon: '🌟', label: 'Sanctuary' },
  ]

  return (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      width: '240px',
      background: 'linear-gradient(180deg, #0a0a0c 0%, #050507 50%, #020203 100%)',
      borderRight: '1px solid #1a1a1f',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      overflow: 'hidden',
    }}>
      {/* Stained Glass Strip - Left Edge */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        background: 'linear-gradient(180deg, rgba(139,92,246,0.6) 0%, rgba(34,197,94,0.6) 25%, rgba(30,64,175,0.6) 50%, rgba(245,158,11,0.6) 75%, rgba(168,85,247,0.6) 100%)',
        boxShadow: '0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(34,197,94,0.2)',
      }} />

      {/* Fog Effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Magical sparkle drips */}
      {[15, 45, 120, 180].map((left, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${left}px`,
            top: 0,
            width: '2px',
            height: '15px',
            background: 'linear-gradient(180deg, transparent, #a855f7, #6366f1)',
            borderRadius: '0 0 2px 2px',
            animation: `sparkleFloat ${6 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 1.5}s`,
          }}
        />
      ))}

      {/* Logo / Brand */}
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid rgba(139,92,246,0.15)',
        position: 'relative',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          {/* Logo Icon with Glow */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #1a1a1f 0%, #0a0a0c 100%)',
            border: '2px solid #22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 0 20px rgba(34,197,94,0.4), inset 0 0 15px rgba(34,197,94,0.3)',
            animation: 'magicGlow 3s ease-in-out infinite',
          }}>
            💊
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 800,
              fontSize: '18px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              <span style={{
                color: '#22c55e',
                textShadow: '0 0 10px rgba(34,197,94,0.8), 0 0 20px rgba(34,197,94,0.4)',
              }}>PUMP</span>
              <span style={{ color: '#8B5CF6' }}>.</span>
              <span style={{
                color: '#e8e8e8',
                textShadow: '0 0 10px rgba(139,92,246,0.5)',
              }}>FUD</span>
            </span>
            <span style={{
              fontSize: '9px',
              color: '#666',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontFamily: 'Cinzel, serif',
            }}>
              PULSECHAIN
            </span>
          </div>
        </Link>

        {/* Decorative Star */}
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '20px',
          color: '#2a2a30',
          opacity: 0.5,
        }}>✦</div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
        {navItems.map((item, index) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '6px',
              textDecoration: 'none',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: isActive(item.path)
                ? 'rgba(34,197,94,0.15)'
                : 'transparent',
              borderLeft: isActive(item.path)
                ? '3px solid #22c55e'
                : '3px solid transparent',
              boxShadow: isActive(item.path)
                ? 'inset 0 0 20px rgba(34,197,94,0.1)'
                : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Hover glow effect */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(34,197,94,0.1) 0%, transparent 100%)',
              opacity: isActive(item.path) ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
            }} />

            <span style={{
              fontSize: '18px',
              filter: isActive(item.path)
                ? 'drop-shadow(0 0 8px rgba(34,197,94,0.8))'
                : 'none',
              animation: isActive(item.path) ? 'gentleFloat 4s ease-in-out infinite' : 'none',
              animationDelay: `${index * 0.2}s`,
            }}>
              {item.icon}
            </span>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              color: isActive(item.path) ? '#22c55e' : '#888',
              textTransform: 'uppercase',
            }}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Summon Token Button */}
      <div style={{ padding: '16px' }}>
        {isConnected ? (
          <Link
            to="/launch"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #166534 100%)',
              border: '1px solid #22c55e',
              color: '#fff',
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              boxShadow: '0 0 20px rgba(34,197,94,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
            }}
          >
            <span style={{ fontSize: '16px' }}>✨</span>
            <span>Create Token</span>
          </Link>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #1a1a1f 0%, #2a2a30 100%)',
                  border: '1px solid #8B5CF6',
                  color: '#8B5CF6',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(139,92,246,0.2)',
                  transition: 'all 0.3s ease',
                }}
              >
                ✦ Enter the Realm ✦
              </button>
            )}
          </ConnectButton.Custom>
        )}
      </div>

      {/* Social Links & Footer */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(139,92,246,0.15)',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '12px' }}>
          <a
            href="https://twitter.com/pumpfud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#666',
              fontSize: '18px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
            }}
          >
            𝕏
          </a>
          <a
            href="https://t.me/pumpfud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#666',
              fontSize: '18px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
            }}
          >
            ✈️
          </a>
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: '8px',
          color: '#333',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          fontFamily: 'Cinzel, serif',
        }}>
          ✦ Forged on PulseChain ✦
        </div>
      </div>

      {/* Decorative corner */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '60px',
        height: '60px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.02) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes sparkleFloat {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(10px); }
        }
        @keyframes magicGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.4), inset 0 0 15px rgba(34,197,94,0.3); }
          50% { box-shadow: 0 0 30px rgba(34,197,94,0.6), inset 0 0 25px rgba(34,197,94,0.4); }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </aside>
  )
}
