import { useState, useEffect } from 'react'

const PROPHECIES = [
  {
    id: 1,
    title: 'Summon Your Token',
    subtitle: 'Create your destiny in the enchanted realm',
    cta: 'Begin Creation',
    link: '/launch',
    gradient: 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #166534 100%)',
    icon: '✨',
    iconGlow: 'rgba(34,197,94,0.6)',
  },
  {
    id: 2,
    title: 'PulseChain Rises',
    subtitle: 'From the ashes of the old world',
    cta: 'Join the Awakening',
    link: 'https://pulsechain.com',
    gradient: 'linear-gradient(135deg, #4B0082 0%, #8B5CF6 50%, #4B0082 100%)',
    icon: '🌙',
    iconGlow: 'rgba(139,92,246,0.6)',
  },
  {
    id: 3,
    title: 'No Rugs. No Escape.',
    subtitle: 'Liquidity sealed in the vault forever',
    cta: 'Learn More',
    link: '/docs',
    gradient: 'linear-gradient(135deg, #1a1a1f 0%, #2a2a30 50%, #1a1a1f 100%)',
    icon: '🔒',
    iconGlow: 'rgba(100,100,100,0.6)',
  },
  {
    id: 4,
    title: 'Spread the Word',
    subtitle: 'Advertise to thousands of believers',
    cta: 'Contact Us',
    link: 'https://t.me/pumpfud',
    gradient: 'linear-gradient(135deg, #701a75 0%, #a855f7 50%, #701a75 100%)',
    icon: '📣',
    iconGlow: 'rgba(168,85,247,0.6)',
  },
  {
    id: 5,
    title: 'Join the Community',
    subtitle: 'Follow for updates and announcements',
    cta: 'Follow Us',
    link: 'https://twitter.com/pumpfud',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
    icon: '🌟',
    iconGlow: 'rgba(30,58,95,0.8)',
  },
]

export function AdCarousel() {
  const [currentAd, setCurrentAd] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentAd((prev) => (prev + 1) % PROPHECIES.length)
        setIsTransitioning(false)
      }, 300)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const prophecy = PROPHECIES[currentAd]

  return (
    <div style={{ padding: '0 20px', marginBottom: '20px' }}>
      <div
        style={{
          background: prophecy.gradient,
          borderRadius: '12px',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: `
            0 0 30px ${prophecy.iconGlow},
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.3)
          `,
          opacity: isTransitioning ? 0.7 : 1,
          transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
        }}
        onClick={() => {
          if (prophecy.link.startsWith('http')) {
            window.open(prophecy.link, '_blank')
          } else {
            window.location.href = prophecy.link
          }
        }}
      >
        {/* Gothic border frame */}
        <div style={{
          position: 'absolute',
          inset: '3px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          pointerEvents: 'none',
        }} />

        {/* Mist effect */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.05) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
          {/* Icon with glow */}
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: `0 0 20px ${prophecy.iconGlow}, inset 0 0 15px rgba(0,0,0,0.5)`,
            animation: 'gentleFloat 4s ease-in-out infinite',
          }}>
            {prophecy.icon}
          </div>
          <div>
            <div style={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: '17px',
              color: '#fff',
              marginBottom: '4px',
              letterSpacing: '0.05em',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}>
              {prophecy.title}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.7)',
              fontStyle: 'italic',
            }}>
              {prophecy.subtitle}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '10px 20px',
            color: '#fff',
            fontFamily: 'Cinzel, serif',
            fontWeight: 600,
            fontSize: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            zIndex: 1,
            transition: 'all 0.3s ease',
            boxShadow: '0 0 10px rgba(0,0,0,0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.4)'
            e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)'
          }}
        >
          {prophecy.cta}
        </button>

        {/* Magical sparkles on sides */}
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '4px',
          height: '20px',
          background: 'linear-gradient(180deg, #a855f7 0%, #6366f1 50%, transparent 100%)',
          borderRadius: '50% 50% 0 0',
          animation: 'sparkleGlow 2s ease-in-out infinite',
          boxShadow: '0 0 8px #a855f7, 0 -5px 15px rgba(168,85,247,0.4)',
        }} />

        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '4px',
          height: '20px',
          background: 'linear-gradient(180deg, #a855f7 0%, #6366f1 50%, transparent 100%)',
          borderRadius: '50% 50% 0 0',
          animation: 'sparkleGlow 2s ease-in-out infinite',
          animationDelay: '0.5s',
          boxShadow: '0 0 8px #a855f7, 0 -5px 15px rgba(168,85,247,0.4)',
        }} />

        {/* Dots */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
        }}>
          {PROPHECIES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                setIsTransitioning(true)
                setTimeout(() => {
                  setCurrentAd(i)
                  setIsTransitioning(false)
                }, 150)
              }}
              style={{
                width: i === currentAd ? '20px' : '6px',
                height: '6px',
                borderRadius: i === currentAd ? '3px' : '50%',
                border: 'none',
                backgroundColor: i === currentAd ? '#22c55e' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
                boxShadow: i === currentAd ? '0 0 8px #22c55e' : 'none',
              }}
            />
          ))}
        </div>

        {/* Shimmer effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
          animation: 'shimmer 4s infinite',
        }} />

        {/* Star watermark */}
        <div style={{
          position: 'absolute',
          right: '60px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '40px',
          color: 'rgba(255,255,255,0.03)',
          pointerEvents: 'none',
        }}>
          ✦
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes sparkleGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
