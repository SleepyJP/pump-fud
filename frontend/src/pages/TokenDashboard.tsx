import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { formatEther, parseEther, isAddress } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI, LEADERBOARD_ADDRESS, LEADERBOARD_ABI } from '../config/wagmi'
import { CandlestickChart } from '../components/CandlestickChart'
import { TransactionFeed } from '../components/TransactionFeed'
import { MessageBoard } from '../components/MessageBoard'
import { DraggableResizableBox } from '../components/ui/DraggableResizableBox'
import { FrameSelector } from '../components/ui/FrameSelector'
import { SharedUIManager } from '../components/ui/SharedUIManager'
import { FeeVerification } from '../components/ui/FeeVerification'
import { useLayout } from '../context/LayoutContext'
import { useCustomFrames } from '../hooks/useCustomFrames'

interface SocialLinks {
  twitter?: string
  telegram?: string
  website?: string
  discord?: string
  instagram?: string
  livestreamUrl?: string
  youtubeStream?: string
  twitch?: string
  kick?: string
}

// Parse livestream URL and return embed URL
function getLivestreamEmbed(url: string): { embedUrl: string; platform: string } | null {
  if (!url) return null

  // YouTube Live / YouTube Video
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`, platform: 'YouTube' }
  }

  // Twitch
  const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
  if (twitchMatch) {
    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    return { embedUrl: `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${parent}&autoplay=true`, platform: 'Twitch' }
  }

  // Kick
  const kickMatch = url.match(/kick\.com\/([a-zA-Z0-9_]+)/)
  if (kickMatch) {
    return { embedUrl: `https://player.kick.com/${kickMatch[1]}`, platform: 'Kick' }
  }

  // If it's already an embed URL, return as-is
  if (url.includes('embed') || url.includes('player.')) {
    return { embedUrl: url, platform: 'Stream' }
  }

  return null
}

interface TokenMetadata {
  description?: string
  socials?: SocialLinks
}

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const

// Background images for variety
const BACKGROUND_IMAGES = [
  '/backgrounds/main-edited.jpg',
  '/backgrounds/cathedral-interior.jpg',
  '/backgrounds/home-cathedral.jpg',
  '/backgrounds/live-tokens-cathedral.jpg',
  '/backgrounds/stained-glass.jpg',
]

export function TokenDashboard() {
  const { tokenId: tokenIdParam } = useParams<{ tokenId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'burn'>('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('5')
  const [referralRegistered, setReferralRegistered] = useState(false)
  const [showLivestream, setShowLivestream] = useState(true)

  // RALPH RL-001/003/004: Layout management for draggable boxes
  const {
    getBoxLayout,
    updateBoxPosition,
    updateBoxSize,
    getZIndex,
    bringToFront,
    isLoaded,
  } = useLayout()

  // RALPH RL-005: Custom frames for draggable boxes
  const {
    frames,
    addFrame,
    assignFrameToBox,
    getBoxFrame,
  } = useCustomFrames()

  const tokenAddress = tokenIdParam as `0x${string}` | undefined
  const refParam = searchParams.get('ref')
  const leaderboardDeployed = true

  // Select background based on token address hash
  const backgroundImage = useMemo(() => {
    if (!tokenAddress) return BACKGROUND_IMAGES[0]
    const hash = parseInt(tokenAddress.slice(2, 8), 16)
    return BACKGROUND_IMAGES[hash % BACKGROUND_IMAGES.length]
  }, [tokenAddress])

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

  const { data: tokenData, isLoading } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getTokenByAddress',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      refetchInterval: 5000, // Poll every 5 seconds for live updates
    },
  })

  const token = useMemo(() => {
    if (!tokenData) return null
    let metadata: TokenMetadata = {}
    try {
      metadata = JSON.parse(tokenData.description)
    } catch {
      metadata = { description: tokenData.description }
    }
    return {
      id: tokenData.id,
      tokenAddress: tokenData.tokenAddress,
      creator: tokenData.creator,
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: metadata.description || '',
      socials: metadata.socials || {},
      imageUri: tokenData.imageUri,
      reserveBalance: tokenData.reserveBalance,
      tokensSold: tokenData.tokensSold,
      status: Number(tokenData.status),
      launchTime: Number(tokenData.createdAt),
      graduated: Number(tokenData.status) === 1,
    }
  }, [tokenData])

  const { data: userTokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
  })

  const { data: totalSupply } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
  })

  const { data: userPlsBalance } = useBalance({ address: userAddress })

  const holderPercentage = useMemo(() => {
    if (!userTokenBalance || !totalSupply || totalSupply === 0n) return 0
    return Number((userTokenBalance * 10000n) / totalSupply) / 100
  }, [userTokenBalance, totalSupply])

  // FIXED: Always use GREEN theme, no dynamic colors
  const theme = {
    primary: '#00ff00',
    secondary: '#00cc00',
    glow: 'rgba(0, 255, 0, 0.4)',
  }

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash })
  const [txStatus, setTxStatus] = useState<string | null>(null)

  // Get buy quote
  const { data: buyQuote } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'calculateBuyAmount',
    args: token && amount && activeTab === 'buy' && parseFloat(amount) > 0
      ? [token.id, parseEther(amount)]
      : undefined,
  })

  // Get sell quote
  const { data: sellQuote } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'calculateSellAmount',
    args: token && amount && activeTab === 'sell' && parseFloat(amount) > 0
      ? [token.id, parseEther(amount)]
      : undefined,
  })

  // Check allowance for selling
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, PUMP_FUD_ADDRESS] : undefined,
  })

  const needsApproval = useMemo(() => {
    if (activeTab !== 'sell' || !amount || !allowance) return false
    try {
      const amountBigInt = parseEther(amount)
      return allowance < amountBigInt
    } catch {
      return false
    }
  }, [activeTab, amount, allowance])

  const handleApprove = () => {
    if (!tokenAddress || !amount) return
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PUMP_FUD_ADDRESS, parseEther(amount)],
    })
  }

  const handleTrade = () => {
    if (!amount || !token) return
    const slippagePct = BigInt(100 - parseInt(slippage))

    if (activeTab === 'buy') {
      const expectedOut = buyQuote || 0n
      const minOut = (expectedOut * slippagePct) / 100n
      writeContract({
        address: PUMP_FUD_ADDRESS,
        abi: PUMP_FUD_ABI,
        functionName: 'buyTokens',
        args: [token.id, minOut],
        value: parseEther(amount),
      })
    } else if (activeTab === 'sell') {
      const expectedOut = sellQuote || 0n
      const minOut = (expectedOut * slippagePct) / 100n
      writeContract({
        address: PUMP_FUD_ADDRESS,
        abi: PUMP_FUD_ABI,
        functionName: 'sellTokens',
        args: [token.id, parseEther(amount), minOut],
      })
    } else if (activeTab === 'burn' && tokenAddress) {
      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [BURN_ADDRESS, parseEther(amount)],
      })
    }
  }

  // Handle transaction success
  useEffect(() => {
    if (isSuccess) {
      setAmount('')
      setTxStatus('✅ Transaction successful!')
      refetchAllowance()
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [isSuccess, refetchAllowance])

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message.includes('User rejected')
        ? 'Transaction cancelled'
        : writeError.message.slice(0, 100)
      setTxStatus(`❌ ${msg}`)
      setTimeout(() => {
        setTxStatus(null)
        resetWrite()
      }, 5000)
    }
    if (txError) {
      setTxStatus(`❌ Transaction failed: ${txError.message.slice(0, 50)}`)
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [writeError, txError, resetWrite])

  // Token-gated access check for chat/board
  const canAccessChat = holderPercentage >= 1.0 // 1% for live chat
  const canAccessBoard = holderPercentage >= 0.5 // 0.5% for message board

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ff00',
        backgroundColor: '#0a0a0a',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/images/pump-pill-neon.png" 
            alt="Loading" 
            style={{ 
              width: '80px', 
              height: '80px', 
              marginBottom: '16px',
              animation: 'pulse 2s ease-in-out infinite',
              filter: 'drop-shadow(0 0 20px rgba(0,255,0,0.6))',
            }} 
          />
          <div style={{ fontSize: '18px', fontFamily: 'monospace' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        backgroundColor: '#0a0a0a',
        gap: '16px',
      }}>
        <p>Token not found</p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #00ff00',
            color: '#00ff00',
            cursor: 'pointer',
          }}
        >
          ← Back to Home
        </button>
      </div>
    )
  }

  const formatBalance = (val: bigint | undefined): string => {
    if (!val) return '0'
    const num = Number(formatEther(val))
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const graduationProgress = Math.min(100, (Number(formatEther(token.reserveBalance)) / 50000000) * 100)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Background Image - Varies per token - RALPH RL-010: Increased from 0.12 to 0.28 */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.28,
        zIndex: 0,
      }} />
      {/* Dark Gradient Overlay - Adjusted for better background visibility */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: `
          linear-gradient(180deg, rgba(10,10,10,0.75) 0%, rgba(10,10,10,0.45) 50%, rgba(10,10,10,0.8) 100%),
          radial-gradient(ellipse at 50% 0%, rgba(0,255,0,0.1) 0%, transparent 40%)
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
        {/* Left - Back + Logo + Token Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Back to Home with Neon Pill Logo */}
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <img 
              src="/images/pump-pill-neon.png" 
              alt="PUMP.FUD" 
              style={{ 
                width: '36px', 
                height: '36px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px rgba(0,255,0,0.6))',
              }} 
            />
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#00ff00',
              letterSpacing: '0.1em',
              textShadow: '0 0 10px rgba(0,255,0,0.6), 0 0 20px rgba(0,255,0,0.4)',
            }}>
              PUMP.FUD
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '30px', backgroundColor: 'rgba(0,255,0,0.2)' }} />

          {/* Token Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#252525',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '2px solid rgba(0,255,0,0.3)',
            }}>
              {token.imageUri ? (
                <img src={token.imageUri} alt={token.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '22px' }}>💎</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                {token.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00ff00' }}>
                ${token.symbol}
              </div>
            </div>

            {/* Status Badge */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '4px',
              backgroundColor: token.graduated ? 'rgba(168,85,247,0.2)' : 'rgba(0,255,0,0.2)',
              border: `1px solid ${token.graduated ? 'rgba(168,85,247,0.5)' : 'rgba(0,255,0,0.5)'}`,
              marginLeft: '8px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: token.graduated ? '#a855f7' : '#00ff00',
              }}>
                {token.graduated ? '🎓 Graduated' : '🟢 Live'}
              </span>
            </div>
          </div>
        </div>

        {/* Right - Stats + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Reserve Display */}
          <div style={{
            padding: '8px 14px',
            backgroundColor: '#252525',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid rgba(0,255,0,0.1)',
          }}>
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Reserve</div>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#00ff00' }}>
              {formatBalance(token.reserveBalance)} PLS
            </div>
          </div>

          {/* Chat Button - Token Gated */}
          <button
            onClick={() => {
              if (!canAccessChat) {
                alert(`💬 Live Chat requires holding 1% of ${token.symbol} supply.\n\nYour holdings: ${holderPercentage.toFixed(2)}%`)
                return
              }
              const params = new URLSearchParams({
                token: tokenAddress || '',
                name: token.name,
                symbol: token.symbol,
                holderPct: holderPercentage.toFixed(2),
              })
              window.open(`/live-chat?${params.toString()}`, 'LiveChat', 'width=420,height=700,menubar=no,toolbar=no,location=no,status=no')
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: canAccessChat ? 'rgba(0,255,0,0.15)' : 'rgba(100,100,100,0.15)',
              border: `1px solid ${canAccessChat ? 'rgba(0,255,0,0.4)' : 'rgba(100,100,100,0.4)'}`,
              color: canAccessChat ? '#00ff00' : '#666',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={canAccessChat ? 'Open Live Chat' : `Requires 1% ${token.symbol} holdings`}
          >
            💬 Chat {!canAccessChat && '🔒'}
          </button>

          {/* Board Button - Token Gated */}
          <button
            onClick={() => {
              if (!canAccessBoard) {
                alert(`📝 Message Board requires holding 0.5% of ${token.symbol} supply.\n\nYour holdings: ${holderPercentage.toFixed(2)}%`)
                return
              }
              const params = new URLSearchParams({
                token: tokenAddress || '',
                name: token.name,
                symbol: token.symbol,
                holderPct: holderPercentage.toFixed(2),
              })
              window.open(`/message-board?${params.toString()}`, 'MessageBoard', 'width=500,height=750,menubar=no,toolbar=no,location=no,status=no')
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              backgroundColor: canAccessBoard ? 'rgba(168,85,247,0.15)' : 'rgba(100,100,100,0.15)',
              border: `1px solid ${canAccessBoard ? 'rgba(168,85,247,0.4)' : 'rgba(100,100,100,0.4)'}`,
              color: canAccessBoard ? '#c084fc' : '#666',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={canAccessBoard ? 'Open Message Board' : `Requires 0.5% ${token.symbol} holdings`}
          >
            📝 Board {!canAccessBoard && '🔒'}
          </button>

          {/* RL-006: Shared UI Manager */}
          <SharedUIManager />

          {/* RL-008: Fee Routing Verification */}
          <div style={{ position: 'relative' }}>
            <FeeVerification />
          </div>

          <ConnectButton />
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - Draggable Boxes (Chart, Trade Panel, Transaction Feed, Message Board)
          RALPH RL-001: Draggable Core System
          RALPH RL-002: Resizable System
          RALPH RL-003: Position/Size Persistence
          RALPH RL-004: Z-Index Management
          ═══════════════════════════════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        zIndex: 2,
      }}>
        {/* ═══════════════════════════════════════════════════════════════════
            FIXED TOP SECTION - Stats + Description/Socials
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{
          padding: '16px 24px',
          position: 'relative',
          zIndex: 50,
        }}>
          {/* Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
          }}>
            {[
              { label: 'Total Supply', value: formatBalance(totalSupply), color: '#fff' },
              { label: 'Tokens Sold', value: formatBalance(token.tokensSold), color: '#00ff00' },
              { label: 'Your Balance', value: formatBalance(userTokenBalance), color: '#00ff00' },
              { label: 'Your Holdings', value: `${holderPercentage.toFixed(2)}%`, color: '#00ff00' },
              { label: 'Creator', value: `${token.creator.slice(0, 6)}...${token.creator.slice(-4)}`, color: '#888' },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(26,26,26,0.9)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,255,0,0.1)',
                  textAlign: 'center',
                  backdropFilter: 'blur(5px)',
                }}
              >
                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: stat.color, marginBottom: '4px' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Token Description & Social Links */}
          {(token.description || Object.keys(token.socials).length > 0) && (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(26,26,26,0.9)',
              borderRadius: '12px',
              border: '1px solid rgba(0,255,0,0.1)',
              backdropFilter: 'blur(5px)',
            }}>
              {token.description && (
                <p style={{ 
                  fontSize: '14px', 
                  color: '#ccc', 
                  margin: 0, 
                  marginBottom: Object.keys(token.socials).length > 0 ? '12px' : 0,
                  lineHeight: '1.5',
                }}>
                  {token.description}
                </p>
              )}
              {Object.keys(token.socials).length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {token.socials.twitter && (
                    <a 
                      href={token.socials.twitter} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(29,155,240,0.2)',
                        borderRadius: '6px',
                        border: '1px solid rgba(29,155,240,0.4)',
                        color: '#1DA1F2',
                        fontSize: '12px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      🐦 Twitter
                    </a>
                  )}
                  {token.socials.telegram && (
                    <a 
                      href={token.socials.telegram} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(0,136,204,0.2)',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,136,204,0.4)',
                        color: '#0088cc',
                        fontSize: '12px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      ✈️ Telegram
                    </a>
                  )}
                  {token.socials.discord && (
                    <a 
                      href={token.socials.discord} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(88,101,242,0.2)',
                        borderRadius: '6px',
                        border: '1px solid rgba(88,101,242,0.4)',
                        color: '#5865F2',
                        fontSize: '12px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      💬 Discord
                    </a>
                  )}
                  {token.socials.website && (
                    <a 
                      href={token.socials.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(0,255,0,0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,255,0,0.3)',
                        color: '#00ff00',
                        fontSize: '12px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DRAGGABLE BOXES CONTAINER
            RALPH RL-001: Draggable Core System
            RALPH RL-002: Resizable System
            RALPH RL-003: Position/Size Persistence
            RALPH RL-004: Z-Index Management
            ═══════════════════════════════════════════════════════════════════ */}
        {isLoaded && (
          <div style={{
            position: 'absolute',
            top: '180px',
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
          }}>
            {/* ═══════════════════════════════════════════════════════════════════
                CHART BOX - Draggable & Resizable
                ═══════════════════════════════════════════════════════════════════ */}
            <DraggableResizableBox
              id="chart-box"
              defaultPosition={getBoxLayout('chart-box')?.position || { x: 20, y: 0 }}
              defaultSize={getBoxLayout('chart-box')?.size || { width: 800, height: 500 }}
              minSize={{ width: 400, height: 300 }}
              maxSize={{ width: 1200, height: 800 }}
              onPositionChange={(pos) => {
                updateBoxPosition('chart-box', pos)
                console.log('[RALPH RL-001] Chart box position saved:', pos)
              }}
              onSizeChange={(size) => {
                updateBoxSize('chart-box', size)
                console.log('[RALPH RL-002] Chart box size saved:', size)
              }}
              zIndex={getZIndex('chart-box')}
              onFocus={() => {
                bringToFront('chart-box')
                console.log('[RALPH RL-004] Chart box brought to front')
              }}
              title="📊 PRICE CHART"
              frameConfig={getBoxFrame('chart-box')}
              frameSelector={
                <FrameSelector
                  frames={frames}
                  selectedFrameId={getBoxFrame('chart-box')?.id || null}
                  onSelect={(frameId) => {
                    assignFrameToBox('chart-box', frameId)
                    console.log('[RALPH RL-005] Chart box frame assigned:', frameId)
                  }}
                  onAddFrame={addFrame}
                  boxId="chart-box"
                />
              }
            >
              <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Livestream Embed - Shows when creator has livestream URL */}
                {(() => {
                  const livestreamUrl = token.socials?.livestreamUrl || token.socials?.youtubeStream || token.socials?.twitch || token.socials?.kick
                  const embed = livestreamUrl ? getLivestreamEmbed(livestreamUrl) : null

                  if (!embed) return null

                  return (
                    <div style={{
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,255,0,0.1)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(0,255,0,0.1)',
                        backgroundColor: 'rgba(0,255,0,0.05)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', animation: 'pulse 2s ease-in-out infinite' }}>🟢</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#00ff00' }}>
                            LIVE on {embed.platform}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowLivestream(!showLivestream)}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: 'transparent',
                            border: '1px solid rgba(0,255,0,0.3)',
                            borderRadius: '4px',
                            color: '#888',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          {showLivestream ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showLivestream && (
                        <div style={{ position: 'relative', width: '100%', paddingTop: '40%' }}>
                          <iframe
                            src={embed.embedUrl}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none',
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Candlestick Chart */}
                <div style={{ flex: 1, minHeight: '200px' }}>
                  <CandlestickChart
                    tokenAddress={tokenAddress || ''}
                    reserveBalance={token.reserveBalance}
                    tokensSold={token.tokensSold}
                    launchTime={token.launchTime}
                    themeColor={theme.primary}
                  />
                </div>

                {/* Graduation Progress */}
                {!token.graduated && (
                  <div style={{
                    padding: '10px 12px',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,255,0,0.1)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>Progress to Graduation</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#00ff00', fontWeight: 700 }}>
                        {graduationProgress.toFixed(1)}% / 50M PLS
                      </span>
                    </div>
                    <div style={{
                      height: '6px',
                      backgroundColor: '#252525',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${graduationProgress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #00ff00 0%, #00cc00 100%)',
                        boxShadow: '0 0 8px rgba(0,255,0,0.6)',
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </DraggableResizableBox>

            {/* ═══════════════════════════════════════════════════════════════════
                TRADE PANEL BOX - Draggable & Resizable
                ═══════════════════════════════════════════════════════════════════ */}
            <DraggableResizableBox
              id="swapper-box"
              defaultPosition={getBoxLayout('swapper-box')?.position || { x: 840, y: 0 }}
              defaultSize={getBoxLayout('swapper-box')?.size || { width: 380, height: 620 }}
              minSize={{ width: 320, height: 400 }}
              maxSize={{ width: 500, height: 900 }}
              onPositionChange={(pos) => {
                updateBoxPosition('swapper-box', pos)
                console.log('[RALPH RL-001] Trade panel position saved:', pos)
              }}
              onSizeChange={(size) => {
                updateBoxSize('swapper-box', size)
                console.log('[RALPH RL-002] Trade panel size saved:', size)
              }}
              zIndex={getZIndex('swapper-box')}
              onFocus={() => {
                bringToFront('swapper-box')
                console.log('[RALPH RL-004] Trade panel brought to front')
              }}
              title={`💱 TRADE ${token.symbol}`}
              frameConfig={getBoxFrame('swapper-box')}
              frameSelector={
                <FrameSelector
                  frames={frames}
                  selectedFrameId={getBoxFrame('swapper-box')?.id || null}
                  onSelect={(frameId) => {
                    assignFrameToBox('swapper-box', frameId)
                    console.log('[RALPH RL-005] Swapper box frame assigned:', frameId)
                  }}
                  onAddFrame={addFrame}
                  boxId="swapper-box"
                />
              }
            >
              <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
                {/* Buy/Sell/Burn Tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '16px',
            padding: '4px',
            backgroundColor: '#252525',
            borderRadius: '8px',
          }}>
            {(['buy', 'sell', 'burn'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  backgroundColor: activeTab === tab
                    ? tab === 'buy' ? 'rgba(0,255,0,0.2)'
                      : tab === 'sell' ? 'rgba(239,68,68,0.2)'
                        : 'rgba(249,115,22,0.2)'
                    : 'transparent',
                  color: activeTab === tab
                    ? tab === 'buy' ? '#00ff00'
                      : tab === 'sell' ? '#ef4444'
                        : '#f97316'
                    : '#666',
                }}
              >
                {tab === 'burn' ? '🔥 Burn' : tab}
              </button>
            ))}
          </div>

          {/* Balance Display */}
          <div style={{
            padding: '12px',
            backgroundColor: '#252525',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: '#888' }}>
              {activeTab === 'buy' ? 'PLS Balance' : 'Token Balance'}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#fff', fontWeight: 600 }}>
              {activeTab === 'buy'
                ? `${Number(formatEther(userPlsBalance?.value || 0n)).toFixed(2)} PLS`
                : `${formatBalance(userTokenBalance)} ${token.symbol}`
              }
            </span>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>
              {activeTab === 'buy' ? 'PLS Amount' : 'Token Amount'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                style={{
                  width: '100%',
                  backgroundColor: '#252525',
                  border: '1px solid rgba(0,255,0,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '18px',
                  fontFamily: 'monospace',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}>
                {activeTab === 'buy' ? 'PLS' : token.symbol}
              </span>
            </div>
          </div>

          {/* Quick Amounts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            marginBottom: '16px',
          }}>
            {(activeTab === 'buy'
              ? ['100', '500', '1K', '5K']
              : ['25%', '50%', '75%', 'MAX']
            ).map((val) => (
              <button
                key={val}
                onClick={() => {
                  if (activeTab === 'buy') {
                    const numVal = val.includes('K') ? parseInt(val) * 1000 : parseInt(val)
                    setAmount(numVal.toString())
                  } else {
                    const pct = val === 'MAX' ? 100 : parseInt(val)
                    const balance = userTokenBalance || 0n
                    const result = (balance * BigInt(pct)) / 100n
                    setAmount(formatEther(result))
                  }
                }}
                style={{
                  padding: '8px',
                  backgroundColor: '#252525',
                  border: '1px solid rgba(0,255,0,0.2)',
                  borderRadius: '6px',
                  color: '#888',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Slippage */}
          {activeTab !== 'burn' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              padding: '10px 12px',
              backgroundColor: '#252525',
              borderRadius: '8px',
            }}>
              <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>Slippage</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['1', '3', '5', '10'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: slippage === val ? 'rgba(0,255,0,0.2)' : 'transparent',
                      border: `1px solid ${slippage === val ? '#00ff00' : '#3a3a3a'}`,
                      borderRadius: '4px',
                      color: slippage === val ? '#00ff00' : '#666',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                    }}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Burn Warning */}
          {activeTab === 'burn' && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <p style={{ color: '#f97316', fontSize: '12px', textAlign: 'center', margin: 0 }}>
                ⚠️ Burning tokens is permanent and irreversible
              </p>
            </div>
          )}

          {/* Expected Output */}
          {activeTab !== 'burn' && amount && parseFloat(amount) > 0 && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(0,255,0,0.1)',
              border: '1px solid rgba(0,255,0,0.3)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {activeTab === 'buy' ? 'You will receive' : 'You will get'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#00ff00' }}>
                  {activeTab === 'buy'
                    ? buyQuote ? `~${formatBalance(buyQuote)} ${token.symbol}` : 'Loading...'
                    : sellQuote ? `~${formatBalance(sellQuote)} PLS` : 'Loading...'
                  }
                </span>
              </div>
            </div>
          )}

          {/* Fee Info */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#252525',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#666' }}>Fee</span>
            <span style={{ color: '#fff', fontFamily: 'monospace' }}>
              {activeTab === 'buy' ? '1%' : activeTab === 'sell' ? '1.10%' : '0%'}
            </span>
          </div>

          {/* Transaction Status */}
          {txStatus && (
            <div style={{
              padding: '12px',
              backgroundColor: txStatus.startsWith('✅') ? 'rgba(0,255,0,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${txStatus.startsWith('✅') ? 'rgba(0,255,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
              borderRadius: '8px',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '13px', color: txStatus.startsWith('✅') ? '#00ff00' : '#ef4444' }}>
                {txStatus}
              </span>
            </div>
          )}

          {/* Trade Button */}
          {isConnected ? (
            needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isPending || isConfirming}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '10px',
                  background: (isPending || isConfirming)
                    ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  cursor: (isPending || isConfirming) ? 'not-allowed' : 'pointer',
                  boxShadow: (isPending || isConfirming) ? 'none' : '0 0 20px rgba(168,85,247,0.4)',
                }}
              >
                {isPending || isConfirming ? '⏳ Approving...' : `🔓 Approve ${token.symbol}`}
              </button>
            ) : (
              <button
                onClick={handleTrade}
                disabled={
                  !amount ||
                  isPending ||
                  isConfirming ||
                  (activeTab === 'buy' && !buyQuote) ||
                  (activeTab === 'sell' && !sellQuote)
                }
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '10px',
                  background: (!amount || isPending || isConfirming || (activeTab === 'buy' && !buyQuote) || (activeTab === 'sell' && !sellQuote))
                    ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                    : activeTab === 'buy'
                      ? 'linear-gradient(135deg, #006600 0%, #00ff00 100%)'
                      : activeTab === 'sell'
                        ? 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)'
                        : 'linear-gradient(135deg, #9a3412 0%, #f97316 100%)',
                  border: 'none',
                  color: activeTab === 'buy' ? '#000' : '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  cursor: (!amount || isPending || isConfirming || (activeTab === 'buy' && !buyQuote) || (activeTab === 'sell' && !sellQuote)) ? 'not-allowed' : 'pointer',
                  boxShadow: (!amount || isPending || isConfirming || (activeTab === 'buy' && !buyQuote) || (activeTab === 'sell' && !sellQuote))
                    ? 'none'
                    : `0 0 20px ${activeTab === 'buy' ? 'rgba(0,255,0,0.5)' : activeTab === 'sell' ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'}`,
                }}
              >
                {isPending || isConfirming ? '⏳ Processing...'
                  : (activeTab === 'buy' && amount && !buyQuote) ? '⏳ Getting quote...'
                  : (activeTab === 'sell' && amount && !sellQuote) ? '⏳ Getting quote...'
                  : activeTab === 'burn' ? '🔥 Burn Tokens'
                    : `${activeTab === 'buy' ? '✨ Buy' : '💫 Sell'} ${token.symbol}`}
              </button>
            )
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#252525',
              borderRadius: '10px',
              border: '1px dashed rgba(0,255,0,0.3)',
            }}>
              <span style={{ fontSize: '12px', color: '#666' }}>Connect wallet to trade</span>
              <ConnectButton />
            </div>
          )}

          {/* Contract Address */}
          <div style={{
            marginTop: '16px',
            padding: '10px 12px',
            backgroundColor: '#252525',
            borderRadius: '8px',
            fontSize: '11px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#666' }}>
              <span>Contract</span>
              <button
                onClick={() => {
                  if (tokenAddress) {
                    navigator.clipboard.writeText(tokenAddress)
                    alert('Copied: ' + tokenAddress)
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  color: '#00ff00',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,255,0,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                title="Click to copy full address"
              >
                {tokenAddress?.slice(0, 8)}...{tokenAddress?.slice(-6)} 📋
              </button>
            </div>
          </div>
              </div>
            </DraggableResizableBox>

            {/* ═══════════════════════════════════════════════════════════════════
                TRANSACTION FEED BOX - Draggable & Resizable
                ═══════════════════════════════════════════════════════════════════ */}
            <DraggableResizableBox
              id="transaction-feed-box"
              defaultPosition={getBoxLayout('transaction-feed-box')?.position || { x: 20, y: 520 }}
              defaultSize={getBoxLayout('transaction-feed-box')?.size || { width: 600, height: 350 }}
              minSize={{ width: 350, height: 250 }}
              maxSize={{ width: 900, height: 600 }}
              onPositionChange={(pos) => {
                updateBoxPosition('transaction-feed-box', pos)
                console.log('[RALPH RL-001] Transaction feed position saved:', pos)
              }}
              onSizeChange={(size) => {
                updateBoxSize('transaction-feed-box', size)
                console.log('[RALPH RL-002] Transaction feed size saved:', size)
              }}
              zIndex={getZIndex('transaction-feed-box')}
              onFocus={() => {
                bringToFront('transaction-feed-box')
                console.log('[RALPH RL-004] Transaction feed brought to front')
              }}
              title="📈 TRANSACTION FEED"
              frameConfig={getBoxFrame('transaction-feed-box')}
              frameSelector={
                <FrameSelector
                  frames={frames}
                  selectedFrameId={getBoxFrame('transaction-feed-box')?.id || null}
                  onSelect={(frameId) => {
                    assignFrameToBox('transaction-feed-box', frameId)
                    console.log('[RALPH RL-005] Transaction feed frame assigned:', frameId)
                  }}
                  onAddFrame={addFrame}
                  boxId="transaction-feed-box"
                />
              }
            >
              <div style={{ height: '100%' }}>
                <TransactionFeed
                  tokenAddress={tokenAddress as `0x${string}`}
                  tokenSymbol={token.symbol}
                  reserveBalance={token.reserveBalance}
                  tokensSold={token.tokensSold}
                />
              </div>
            </DraggableResizableBox>

            {/* ═══════════════════════════════════════════════════════════════════
                MESSAGE BOARD BOX - Draggable & Resizable
                ═══════════════════════════════════════════════════════════════════ */}
            <DraggableResizableBox
              id="message-board-box"
              defaultPosition={getBoxLayout('message-board-box')?.position || { x: 640, y: 520 }}
              defaultSize={getBoxLayout('message-board-box')?.size || { width: 600, height: 350 }}
              minSize={{ width: 350, height: 250 }}
              maxSize={{ width: 900, height: 600 }}
              onPositionChange={(pos) => {
                updateBoxPosition('message-board-box', pos)
                console.log('[RALPH RL-001] Message board position saved:', pos)
              }}
              onSizeChange={(size) => {
                updateBoxSize('message-board-box', size)
                console.log('[RALPH RL-002] Message board size saved:', size)
              }}
              zIndex={getZIndex('message-board-box')}
              onFocus={() => {
                bringToFront('message-board-box')
                console.log('[RALPH RL-004] Message board brought to front')
              }}
              title="💬 MESSAGE BOARD"
              frameConfig={getBoxFrame('message-board-box')}
              frameSelector={
                <FrameSelector
                  frames={frames}
                  selectedFrameId={getBoxFrame('message-board-box')?.id || null}
                  onSelect={(frameId) => {
                    assignFrameToBox('message-board-box', frameId)
                    console.log('[RALPH RL-005] Message board frame assigned:', frameId)
                  }}
                  onAddFrame={addFrame}
                  boxId="message-board-box"
                />
              }
            >
              <div style={{ height: '100%' }}>
                <MessageBoard
                  tokenSymbol={token.symbol}
                  holderPercentage={holderPercentage}
                  primaryColor={theme.primary}
                  secondaryColor={theme.secondary}
                />
              </div>
            </DraggableResizableBox>
          </div>
        )}
      </main>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
