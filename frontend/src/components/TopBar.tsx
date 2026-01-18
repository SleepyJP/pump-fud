import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export function TopBar() {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: '240px',
      right: '80px',
      height: '64px',
      background: 'linear-gradient(180deg, rgba(10,10,12,0.98) 0%, rgba(5,5,7,0.95) 100%)',
      borderBottom: '1px solid rgba(139,92,246,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 50,
      backdropFilter: 'blur(10px)',
    }}>
      {/* Decorative top border */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, #DC143C 20%, #8B5CF6 50%, #DC143C 80%, transparent 100%)',
      }} />

      {/* Gothic ornament left */}
      <div style={{
        position: 'absolute',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'rgba(139,92,246,0.2)',
        fontSize: '12px',
        letterSpacing: '2px',
      }}>
        ⛧
      </div>

      {/* Search */}
      <div style={{
        position: 'relative',
        width: '320px',
        marginLeft: '30px',
      }}>
        <input
          type="text"
          placeholder="Search the crypt..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%',
            backgroundColor: searchFocused ? 'rgba(30,30,36,0.9)' : 'rgba(20,20,26,0.8)',
            border: searchFocused ? '1px solid rgba(220,20,60,0.4)' : '1px solid rgba(42,42,48,0.8)',
            borderRadius: '8px',
            padding: '10px 14px 10px 40px',
            fontSize: '13px',
            color: '#e8e8e8',
            outline: 'none',
            fontFamily: 'Cinzel, serif',
            letterSpacing: '0.03em',
            transition: 'all 0.3s ease',
            boxShadow: searchFocused
              ? '0 0 20px rgba(220,20,60,0.15), inset 0 0 10px rgba(0,0,0,0.3)'
              : 'inset 0 0 10px rgba(0,0,0,0.3)',
          }}
        />
        <span style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: searchFocused ? '#DC143C' : '#555',
          fontSize: '14px',
          transition: 'color 0.3s ease',
        }}>
          🔮
        </span>

        {/* Mystic glow on focus */}
        {searchFocused && (
          <div style={{
            position: 'absolute',
            inset: '-2px',
            borderRadius: '10px',
            background: 'linear-gradient(90deg, rgba(220,20,60,0.2), rgba(139,92,246,0.2), rgba(220,20,60,0.2))',
            zIndex: -1,
            animation: 'spectralShimmer 2s linear infinite',
          }} />
        )}
      </div>

      {/* Center - Live Souls Counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px',
        background: 'rgba(139,0,0,0.15)',
        borderRadius: '20px',
        border: '1px solid rgba(220,20,60,0.2)',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#DC143C',
          animation: 'candleFlicker 1s ease-in-out infinite',
          boxShadow: '0 0 8px #DC143C',
        }} />
        <span style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '11px',
          color: '#DC143C',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          666 Souls Online
        </span>
      </div>

      {/* Right Side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Summon Button */}
        <Link
          to="/launch"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(139,0,0,0.3) 0%, rgba(220,20,60,0.2) 100%)',
            border: '1px solid rgba(220,20,60,0.4)',
            color: '#DC143C',
            fontFamily: 'Cinzel, serif',
            fontWeight: 600,
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            boxShadow: '0 0 15px rgba(220,20,60,0.1)',
          }}
        >
          <span style={{ fontSize: '14px' }}>🩸</span>
          <span>Summon</span>
        </Link>

        {/* Wallet Connect with custom styling wrapper */}
        <div style={{
          position: 'relative',
        }}>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
          {/* Overlay glow effect */}
          <div style={{
            position: 'absolute',
            inset: '-1px',
            borderRadius: '12px',
            border: '1px solid rgba(139,92,246,0.2)',
            pointerEvents: 'none',
            boxShadow: '0 0 10px rgba(139,92,246,0.1)',
          }} />
        </div>
      </div>

      {/* Gothic ornament right */}
      <div style={{
        position: 'absolute',
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'rgba(139,92,246,0.2)',
        fontSize: '12px',
        letterSpacing: '2px',
      }}>
        ⛧
      </div>

      {/* Bottom shadow fade */}
      <div style={{
        position: 'absolute',
        bottom: '-20px',
        left: 0,
        right: 0,
        height: '20px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </header>
  )
}
