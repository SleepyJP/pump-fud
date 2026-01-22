import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReadContract, useWriteContract, useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatEther, isAddress } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI, LEADERBOARD_ADDRESS, LEADERBOARD_ABI } from '../config/wagmi'
import { AdCarousel } from '../components/AdCarousel'

type FilterOption = 'live' | 'rising' | 'new' | 'graduated'

export function HomePage() {
  const [filter, setFilter] = useState<FilterOption>('live')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { address: userAddress, isConnected } = useAccount()
  const [referralRegistered, setReferralRegistered] = useState(false)

  const refParam = searchParams.get('ref')
  const leaderboardDeployed = true

  // Check if user already has a referrer
  const { data: existingReferrer } = useReadContract({
    address: leaderboardDeployed ? LEADERBOARD_ADDRESS : undefined,
    abi: LEADERBOARD_ABI,
    functionName: 'referrerOf',
    args: userAddress ? [userAddress] : undefined,
  })

  // Register referrer from URL param
  const { writeContract: registerRef, isPending: isRegisteringRef } = useWriteContract()

  useEffect(() => {
    if (
      leaderboardDeployed &&
      isConnected &&
      userAddress &&
      refParam &&
      isAddress(refParam) &&
      refParam.toLowerCase() !== userAddress.toLowerCase() &&
      existingReferrer === '0x0000000000000000000000000000000000000000' &&
      !referralRegistered &&
      !isRegisteringRef
    ) {
      registerRef({
        address: LEADERBOARD_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'registerReferrer',
        args: [refParam as `0x${string}`],
      })
      setReferralRegistered(true)
    }
  }, [leaderboardDeployed, isConnected, userAddress, refParam, existingReferrer, referralRegistered, isRegisteringRef, registerRef])

  // Fetch all tokens (paginated)
  const { data: allTokens } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getAllTokens',
    args: [0n, 100n],
  })

  // Process and filter tokens
  const tokens = (allTokens || []).map((t) => ({
    id: t.id,
    tokenAddress: t.tokenAddress,
    name: t.name,
    symbol: t.symbol,
    description: t.description,
    imageUri: t.imageUri,
    creator: t.creator,
    reserveBalance: t.reserveBalance,
    tokensSold: t.tokensSold,
    status: Number(t.status),
    launchTime: Number(t.createdAt),
  }))

  // Filter tokens based on selection
  const filteredTokens = tokens.filter(token => {
    switch (filter) {
      case 'live': return token.status === 0
      case 'graduated': return token.status === 1
      case 'new': return token.status === 0
      case 'rising': return token.status === 0
      default: return true
    }
  }).sort((a, b) => {
    if (filter === 'new') return b.launchTime - a.launchTime
    if (filter === 'rising') return Number(b.reserveBalance - a.reserveBalance)
    return 0
  })

  const filters: { key: FilterOption; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'rising', label: 'Rising' },
    { key: 'new', label: 'New' },
    { key: 'graduated', label: 'Graduated' },
  ]

  const formatMcap = (reserve: bigint): string => {
    const value = Number(formatEther(reserve))
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toFixed(0)
  }

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() / 1000 - timestamp
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Dynamic backgrounds per filter - visible but not overbearing (0.28 opacity)
  const backgroundMap: Record<FilterOption, string> = {
    live: '/backgrounds/main-edited.jpg',           // Cathedral vending machine vibe
    rising: '/backgrounds/stained-glass.jpg',       // Green stained glass cathedral  
    new: '/backgrounds/fantasy-tree-maze.png',      // Enchanted tree portal
    graduated: '/backgrounds/launch-altar.png',     // Celebratory altar
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Dynamic Filter Background - 28% opacity for visibility */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url(${backgroundMap[filter]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        opacity: 0.28,
        zIndex: 0,
        transition: 'background-image 0.5s ease-in-out',
      }} />
      {/* Dark Gradient Overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: `
          linear-gradient(180deg, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.4) 30%, rgba(10,10,10,0.6) 70%, rgba(10,10,10,0.95) 100%),
          radial-gradient(ellipse at 50% 0%, rgba(0,255,0,0.08) 0%, transparent 50%)
        `,
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER BAR - Full Width
          ═══════════════════════════════════════════════════════════════════ */}
      <header style={{
        height: '60px',
        backgroundColor: 'rgba(26,26,26,0.95)',
        borderBottom: '1px solid rgba(0,255,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 100,
        position: 'relative',
        backdropFilter: 'blur(10px)',
      }}>
        {/* Left - Logo & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <img src="/images/pump-pill-neon.png" alt="PUMP.FUD" style={{ width: '32px', height: '32px' }} />
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#00ff00',
              letterSpacing: '0.1em',
              textShadow: '0 0 10px rgba(0,255,0,0.5)',
            }}>
              PUMP.FUD
            </span>
          </div>

          {/* Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '20px' }}>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  backgroundColor: filter === f.key ? '#00cc00' : 'transparent',
                  color: filter === f.key ? '#fff' : '#888',
                }}
              >
                {f.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right - Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/leaderboard')}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #ffd700',
              borderRadius: '8px',
              color: '#ffd700',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,215,0,0.1)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255,215,0,0.3)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            👑 Leaderboard
          </button>
          <button
            onClick={() => navigate('/launch')}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #00CC00 0%, #00FF00 50%, #00CC00 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,255,0,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,0,0.5)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,0,0.3)'
            }}
          >
            ⚒️ Forge Token
          </button>
          <ConnectButton />
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - Scrollable Token Grid
          ═══════════════════════════════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Ad Carousel */}
        <div style={{ marginBottom: '20px' }}>
          <AdCarousel />
        </div>

        {/* Section Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#fff',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ color: '#22c55e' }}>●</span>
            {filter === 'live' && 'Live Tokens'}
            {filter === 'rising' && 'Rising Tokens'}
            {filter === 'new' && 'New Tokens'}
            {filter === 'graduated' && 'Graduated Tokens'}
            <span style={{ color: '#666', fontSize: '14px', fontWeight: 400 }}>
              ({filteredTokens.length})
            </span>
          </h2>
        </div>

        {/* Token Grid */}
        {filteredTokens.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: '#666',
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px', opacity: 0.5 }}>🔥</span>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No tokens found</p>
            <p style={{ fontSize: '13px', color: '#555' }}>Be the first to create one!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {filteredTokens.map((token) => {
              // Generate color from address
              const hash = parseInt(token.tokenAddress.slice(2, 8), 16)
              const hue = hash % 360
              const accentColor = `hsl(${hue}, 60%, 50%)`

              return (
                <div
                  key={token.tokenAddress}
                  onClick={() => navigate(`/dashboard/${token.tokenAddress}`)}
                  style={{
                    background: 'rgba(26,26,26,0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = accentColor
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                    e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.4), 0 0 30px ${accentColor}30`
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    {/* Token Image */}
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '10px',
                      backgroundColor: '#252525',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: `2px solid ${accentColor}40`,
                    }}>
                      {token.imageUri ? (
                        <img
                          src={token.imageUri}
                          alt={token.symbol}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '28px' }}>🔥</span>
                      )}
                    </div>

                    {/* Token Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {token.name}
                      </div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: accentColor,
                        marginBottom: '4px',
                      }}>
                        ${token.symbol}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#666',
                      }}>
                        {formatTime(token.launchTime)}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: token.status === 1 ? 'rgba(168,85,247,0.2)' : 'rgba(34,197,94,0.2)',
                      border: `1px solid ${token.status === 1 ? 'rgba(168,85,247,0.4)' : 'rgba(34,197,94,0.4)'}`,
                    }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: token.status === 1 ? '#a855f7' : '#22c55e',
                      }}>
                        {token.status === 1 ? '🎓' : '🔴'}
                      </span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: '1px solid #252525',
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Reserve</div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#22c55e',
                      }}>
                        {formatMcap(token.reserveBalance)} PLS
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Creator</div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#888',
                      }}>
                        {token.creator.slice(0, 6)}...{token.creator.slice(-4)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar (for live tokens) */}
                  {token.status === 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '10px',
                        color: '#666',
                        marginBottom: '4px',
                      }}>
                        <span>Progress to Graduation</span>
                        <span style={{ color: accentColor, fontFamily: 'monospace' }}>
                          {Math.min(100, (Number(formatEther(token.reserveBalance)) / 50000000) * 100).toFixed(1)}% / 50M PLS
                        </span>
                      </div>
                      <div style={{
                        height: '4px',
                        backgroundColor: '#252525',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.min(100, (Number(formatEther(token.reserveBalance)) / 50000000) * 100)}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}80 100%)`,
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
