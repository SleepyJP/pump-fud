interface StainedGlassPanelProps {
  side: 'left' | 'right'
}

export function StainedGlassPanel({ side }: StainedGlassPanelProps) {
  const isLeft = side === 'left'

  // Generate glass segments for variety
  const segments = [
    { color: 'rgba(34,197,94,0.5)', height: '12%' },      // Emerald
    { color: 'rgba(139,92,246,0.5)', height: '8%' },      // Purple
    { color: 'rgba(30,64,175,0.5)', height: '15%' },      // Deep Blue
    { color: 'rgba(168,85,247,0.4)', height: '10%' },     // Violet
    { color: 'rgba(245,158,11,0.5)', height: '7%' },      // Amber
    { color: 'rgba(34,197,94,0.4)', height: '13%' },      // Emerald lighter
    { color: 'rgba(139,92,246,0.6)', height: '9%' },      // Purple brighter
    { color: 'rgba(30,64,175,0.4)', height: '11%' },      // Blue lighter
    { color: 'rgba(245,158,11,0.4)', height: '8%' },      // Gold
    { color: 'rgba(168,85,247,0.5)', height: '7%' },      // Violet
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        [side]: 0,
        width: isLeft ? '240px' : '80px',
        height: '100vh',
        zIndex: isLeft ? 35 : 30,
        pointerEvents: 'none',
        ...(isLeft ? { left: 0 } : {}),
      }}
    >
      {/* Main Glass Panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          [isLeft ? 'right' : 'left']: 0,
          width: isLeft ? '0' : '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!isLeft && segments.map((segment, i) => (
          <div
            key={i}
            style={{
              height: segment.height,
              background: segment.color,
              position: 'relative',
              borderBottom: '2px solid rgba(0,0,0,0.8)',
            }}
          >
            {/* Lead framing effect */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderLeft: '3px solid rgba(20,20,20,0.9)',
                borderRight: '3px solid rgba(20,20,20,0.9)',
              }}
            />
            {/* Light refraction effect */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%)',
              }}
            />
          </div>
        ))}
      </div>

      {/* Gothic Arch Frame - Right Side Only */}
      {!isLeft && (
        <>
          {/* Stone frame */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '6px',
              height: '100%',
              background: 'linear-gradient(180deg, #1a1a1f 0%, #111114 50%, #0a0a0c 100%)',
              boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.5)',
            }}
          />

          {/* Inner glow from glass */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '6px',
              right: 0,
              height: '100%',
              background: 'linear-gradient(90deg, rgba(139,92,246,0.1) 0%, transparent 50%)',
              animation: 'glassShimmer 8s ease-in-out infinite',
            }}
          />

          {/* Decorative top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '80px',
              background: `
                radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.03) 0%, transparent 40%),
                linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 30%)
              `,
            }}
          />

          {/* Dust motes */}
          {[20, 40, 55, 70].map((top, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}%`,
                left: '30%',
                width: '2px',
                height: '2px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                animation: `dustFloat ${10 + i * 3}s ease-in-out infinite`,
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}

          {/* Magical sparkle drips */}
          {[15, 50].map((left, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: 0,
                width: '2px',
                height: '20px',
                background: 'linear-gradient(180deg, transparent, #a855f7 30%, #6366f1)',
                borderRadius: '0 0 2px 2px',
                animation: `sparkleFloat ${10 + i * 4}s ease-in-out infinite`,
                animationDelay: `${i * 3}s`,
              }}
            />
          ))}

          {/* Candle glow at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '20%',
              width: '6px',
              height: '12px',
              background: 'linear-gradient(180deg, #a855f7 0%, #6366f1 50%, #4B0082 100%)',
              borderRadius: '50% 50% 20% 20%',
              animation: 'candleFlicker 0.5s ease-in-out infinite',
              boxShadow: '0 0 10px #a855f7, 0 0 20px rgba(168,85,247,0.5), 0 0 30px rgba(139,92,246,0.3)',
            }}
          />

          {/* Candle base */}
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(10% - 8px)',
              left: 'calc(20% - 2px)',
              width: '10px',
              height: '8px',
              background: '#2a2a30',
              borderRadius: '2px',
            }}
          />

          {/* Second candle */}
          <div
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '60%',
              width: '5px',
              height: '10px',
              background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #166534 100%)',
              borderRadius: '50% 50% 20% 20%',
              animation: 'candleFlicker 0.6s ease-in-out infinite',
              animationDelay: '0.2s',
              boxShadow: '0 0 8px #22c55e, 0 0 15px rgba(34,197,94,0.4)',
            }}
          />
        </>
      )}

      {/* Star symbol */}
      {!isLeft && (
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '24px',
            color: 'rgba(139,92,246,0.15)',
            textShadow: '0 0 10px rgba(139,92,246,0.3)',
          }}
        >
          ✦
        </div>
      )}

      {/* Moon at bottom */}
      {!isLeft && (
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px',
            color: 'rgba(168,85,247,0.2)',
            textShadow: '0 0 8px rgba(168,85,247,0.3)',
          }}
        >
          🌙
        </div>
      )}

      <style>{`
        @keyframes sparkleFloat {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(10px); }
        }
      `}</style>
    </div>
  )
}
