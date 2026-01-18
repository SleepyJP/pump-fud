import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'
import { PriceChart } from '../components/PriceChart'
import { MessageBoard } from '../components/MessageBoard'

interface SocialLinks {
  twitter?: string
  telegram?: string
  website?: string
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

export function TokenDashboard() {
  const { tokenId: tokenIdParam } = useParams<{ tokenId: string }>()
  const navigate = useNavigate()
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'burn'>('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('5')

  const tokenAddress = tokenIdParam as `0x${string}` | undefined

  const { data: tokenData, isLoading } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getTokenByAddress',
    args: tokenAddress ? [tokenAddress] : undefined,
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

  const theme = useMemo(() => {
    if (!tokenAddress) return { primary: '#ffd700', secondary: '#b8860b' }
    const hash = parseInt(tokenAddress.slice(2, 8), 16)
    const hue = hash % 360
    return {
      primary: `hsl(${hue}, 70%, 50%)`,
      secondary: `hsl(${hue}, 60%, 40%)`,
    }
  }, [tokenAddress])

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

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

  useEffect(() => {
    if (isSuccess) setAmount('')
  }, [isSuccess])

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        backgroundColor: '#0f0f0f',
      }}>
        Loading...
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
        backgroundColor: '#0f0f0f',
        gap: '16px',
      }}>
        <p>Token not found</p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#fff',
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

  const graduationProgress = Math.min(100, (Number(formatEther(token.reserveBalance)) / 100000) * 100)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#0f0f0f',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER BAR - Full Width
          ═══════════════════════════════════════════════════════════════════ */}
      <header style={{
        height: '60px',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 100,
      }}>
        {/* Left - Back + Logo + Token Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Back to Home */}
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '28px' }}>🔥</span>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '18px',
              fontWeight: 700,
              color: '#dc143c',
              letterSpacing: '0.1em',
            }}>
              PUMP.FUD
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '30px', backgroundColor: '#2a2a2a' }} />

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
              border: `2px solid ${theme.primary}50`,
            }}>
              {token.imageUri ? (
                <img src={token.imageUri} alt={token.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '22px' }}>🔥</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                {token.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: theme.primary }}>
                ${token.symbol}
              </div>
            </div>

            {/* Status Badge */}
            <div style={{
              padding: '4px 10px',
              borderRadius: '4px',
              backgroundColor: token.graduated ? 'rgba(168,85,247,0.2)' : 'rgba(34,197,94,0.2)',
              border: `1px solid ${token.graduated ? 'rgba(168,85,247,0.5)' : 'rgba(34,197,94,0.5)'}`,
              marginLeft: '8px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: token.graduated ? '#a855f7' : '#22c55e',
              }}>
                {token.graduated ? '🎓 Graduated' : '🔴 Live'}
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
          }}>
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>Reserve</div>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>
              {formatBalance(token.reserveBalance)} PLS
            </div>
          </div>

          {/* Chat Button */}
          <button
            onClick={() => {
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
              backgroundColor: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.4)',
              color: '#60a5fa',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            💬 Chat
          </button>

          {/* Board Button */}
          <button
            onClick={() => {
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
              backgroundColor: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: '#c084fc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📝 Board
          </button>

          <ConnectButton />
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - Chart + Trade Panel
          ═══════════════════════════════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        padding: '16px 24px',
        overflow: 'hidden',
      }}>
        {/* LEFT - Chart Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: 0,
          overflow: 'auto',
        }}>
          {/* Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
          }}>
            {[
              { label: 'Total Supply', value: formatBalance(totalSupply), color: '#fff' },
              { label: 'Tokens Sold', value: formatBalance(token.tokensSold), color: '#22c55e' },
              { label: 'Your Balance', value: formatBalance(userTokenBalance), color: theme.primary },
              { label: 'Your Holdings', value: `${holderPercentage.toFixed(2)}%`, color: theme.primary },
              { label: 'Creator', value: `${token.creator.slice(0, 6)}...${token.creator.slice(-4)}`, color: '#888' },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '8px',
                  border: '1px solid #2a2a2a',
                  textAlign: 'center',
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

          {/* Chart */}
          <div style={{
            flex: 1,
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            padding: '16px',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <PriceChart
                tokenAddress={tokenAddress || ''}
                reserveBalance={token.reserveBalance}
                tokensSold={token.tokensSold}
                launchTime={token.launchTime}
                themeColor={theme.primary}
              />
            </div>
          </div>

          {/* Graduation Progress */}
          {!token.graduated && (
            <div style={{
              padding: '14px 18px',
              backgroundColor: '#1a1a1a',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Progress to Graduation</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: theme.primary, fontWeight: 700 }}>
                  {graduationProgress.toFixed(1)}% / 100K PLS
                </span>
              </div>
              <div style={{
                height: '8px',
                backgroundColor: '#252525',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${graduationProgress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                  boxShadow: `0 0 10px ${theme.primary}60`,
                }} />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              MESSAGE BOARD - Live Thread Below Chart
              ═══════════════════════════════════════════════════════════════════ */}
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            overflow: 'hidden',
          }}>
            <MessageBoard
              tokenSymbol={token.symbol}
              holderPercentage={holderPercentage}
              primaryColor={theme.primary}
              secondaryColor={theme.secondary}
            />
          </div>
        </div>

        {/* RIGHT - Trade Panel */}
        <div style={{
          width: '360px',
          flexShrink: 0,
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>💱</span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Trade {token.symbol}
            </h2>
          </div>

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
                    ? tab === 'buy' ? 'rgba(34,197,94,0.2)'
                      : tab === 'sell' ? 'rgba(239,68,68,0.2)'
                        : 'rgba(249,115,22,0.2)'
                    : 'transparent',
                  color: activeTab === tab
                    ? tab === 'buy' ? '#22c55e'
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
                  border: '1px solid #3a3a3a',
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
                  border: '1px solid #3a3a3a',
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
                      backgroundColor: slippage === val ? theme.primary + '30' : 'transparent',
                      border: `1px solid ${slippage === val ? theme.primary : '#3a3a3a'}`,
                      borderRadius: '4px',
                      color: slippage === val ? theme.primary : '#666',
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
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {activeTab === 'buy' ? 'You will receive' : 'You will get'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>
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

          {/* Trade Button */}
          {isConnected ? (
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
                    ? 'linear-gradient(135deg, #166534 0%, #22c55e 100%)'
                    : activeTab === 'sell'
                      ? 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)'
                      : 'linear-gradient(135deg, #9a3412 0%, #f97316 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                cursor: (!amount || isPending || isConfirming || (activeTab === 'buy' && !buyQuote) || (activeTab === 'sell' && !sellQuote)) ? 'not-allowed' : 'pointer',
                boxShadow: (!amount || isPending || isConfirming || (activeTab === 'buy' && !buyQuote) || (activeTab === 'sell' && !sellQuote))
                  ? 'none'
                  : `0 0 20px ${activeTab === 'buy' ? 'rgba(34,197,94,0.4)' : activeTab === 'sell' ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'}`,
              }}
            >
              {isPending || isConfirming ? '⏳ Processing...'
                : (activeTab === 'buy' && amount && !buyQuote) ? '⏳ Getting quote...'
                : (activeTab === 'sell' && amount && !sellQuote) ? '⏳ Getting quote...'
                : activeTab === 'burn' ? '🔥 Burn Tokens'
                  : `${activeTab === 'buy' ? '✨ Buy' : '💫 Sell'} ${token.symbol}`}
            </button>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#252525',
              borderRadius: '10px',
              border: '1px dashed #3a3a3a',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
              <span>Contract</span>
              <span style={{ fontFamily: 'monospace', color: theme.primary }}>
                {tokenAddress?.slice(0, 8)}...{tokenAddress?.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
