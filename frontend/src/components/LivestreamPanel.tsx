import { useState } from 'react'
import { useAccount } from 'wagmi'

interface LivestreamPanelProps {
  tokenSymbol: string
  holderPercentage: number
  primaryColor: string
  secondaryColor: string
  isLive: boolean
  streamerAddress?: string
}

export function LivestreamPanel({
  tokenSymbol,
  holderPercentage,
  primaryColor,
  secondaryColor,
  isLive,
  streamerAddress,
}: LivestreamPanelProps) {
  const { isConnected } = useAccount()
  const [isStreaming, setIsStreaming] = useState(false)
  const canStream = holderPercentage >= 1.0

  const handleStartStream = () => {
    if (!canStream) return
    setIsStreaming(true)
  }

  const handleStopStream = () => {
    setIsStreaming(false)
  }

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(17,17,20,0.95) 0%, rgba(10,10,12,0.98) 100%)',
        border: `1px solid ${isLive ? primaryColor : 'rgba(139,92,246,0.2)'}`,
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Live indicator bar */}
      {isLive && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent 0%, ${primaryColor} 30%, ${secondaryColor} 70%, transparent 100%)`,
            animation: 'livePulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Video area */}
      <div
        style={{
          aspectRatio: '16/9',
          backgroundColor: '#0a0a0c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          backgroundImage: 'url(/backgrounds/neon-main.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
          }}
        />

        {isLive && streamerAddress ? (
          <>
            {/* Live badge */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'rgba(220,20,60,0.9)',
                borderRadius: '6px',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  animation: 'liveDot 1s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                  letterSpacing: '0.1em',
                }}
              >
                LIVE
              </span>
            </div>

            {/* Viewer count */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: '6px',
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: '14px' }}>👁️</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#e8e8e8',
                }}
              >
                {Math.floor(Math.random() * 500) + 100}
              </span>
            </div>

            {/* Stream placeholder */}
            <div
              style={{
                position: 'relative',
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  boxShadow: `0 0 30px ${primaryColor}80`,
                  animation: 'gentleFloat 3s ease-in-out infinite',
                }}
              >
                📺
              </div>
              <span
                style={{
                  fontFamily: 'Cinzel, serif',
                  color: '#e8e8e8',
                  fontSize: '14px',
                }}
              >
                {streamerAddress.slice(0, 6)}...{streamerAddress.slice(-4)} is streaming
              </span>
            </div>
          </>
        ) : isStreaming ? (
          <div
            style={{
              position: 'relative',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            {/* Recording indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'rgba(220,20,60,0.9)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  animation: 'liveDot 1s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#fff',
                }}
              >
                LIVE - YOU ARE STREAMING
              </span>
            </div>

            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '60px',
                boxShadow: `0 0 50px ${primaryColor}`,
                animation: 'gentleFloat 3s ease-in-out infinite',
              }}
            >
              🎙️
            </div>

            <button
              onClick={handleStopStream}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)',
                border: 'none',
                color: '#fff',
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              End Stream
            </button>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '40px',
            }}
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: canStream
                  ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                  : 'linear-gradient(135deg, #333 0%, #222 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                boxShadow: canStream ? `0 0 40px ${primaryColor}60` : 'none',
                opacity: canStream ? 1 : 0.5,
              }}
            >
              📡
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '18px',
                  color: '#e8e8e8',
                  marginBottom: '8px',
                  letterSpacing: '0.05em',
                }}
              >
                {canStream ? 'Go Live' : 'Livestream Locked'}
              </h3>
              <p
                style={{
                  color: '#888',
                  fontSize: '13px',
                  fontStyle: 'italic',
                }}
              >
                {canStream
                  ? `Share your wisdom with ${tokenSymbol} holders`
                  : `Hold 1%+ of ${tokenSymbol} to unlock streaming`}
              </p>
            </div>

            {canStream && isConnected ? (
              <button
                onClick={handleStartStream}
                style={{
                  padding: '14px 32px',
                  borderRadius: '10px',
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: `0 0 30px ${primaryColor}40`,
                  transition: 'all 0.3s ease',
                }}
              >
                ✨ Start Streaming
              </button>
            ) : !isConnected ? (
              <div
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: '1px dashed rgba(139,92,246,0.3)',
                  borderRadius: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '12px',
                    color: '#666',
                  }}
                >
                  Connect wallet to stream
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: 'rgba(139,69,19,0.2)',
                  border: '1px solid rgba(139,69,19,0.4)',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '16px' }}>🔒</span>
                <span
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '12px',
                    color: '#b8860b',
                  }}
                >
                  You hold {holderPercentage.toFixed(2)}% (need 1%+)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stream info bar */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: `1px solid ${isLive ? primaryColor + '30' : 'rgba(139,92,246,0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📺</span>
          <div>
            <p
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '14px',
                color: '#e8e8e8',
                letterSpacing: '0.05em',
              }}
            >
              {tokenSymbol} Stream
            </p>
            <p
              style={{
                fontSize: '11px',
                color: '#666',
              }}
            >
              {isLive ? 'Live now' : 'No active stream'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
          }}
        >
          <span style={{ fontSize: '12px' }}>🎯</span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: primaryColor,
            }}
          >
            1%+ to stream
          </span>
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes liveDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
