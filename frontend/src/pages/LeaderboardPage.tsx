import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { LEADERBOARD_ADDRESS, LEADERBOARD_ABI } from '../config/wagmi'

type TabType = 'volume' | 'referrals' | 'roi'

interface LeaderboardEntry {
  rank: number
  address: string
  value: string
  secondaryValue?: string
  isCurrentUser: boolean
}

// Placeholder data for when contract isn't deployed yet
const PLACEHOLDER_DATA: Record<TabType, LeaderboardEntry[]> = {
  volume: [
    { rank: 1, address: '0x1234...5678', value: '2.5M PLS', secondaryValue: '156 trades', isCurrentUser: false },
    { rank: 2, address: '0xabcd...efgh', value: '1.8M PLS', secondaryValue: '98 trades', isCurrentUser: false },
    { rank: 3, address: '0x9876...5432', value: '1.2M PLS', secondaryValue: '234 trades', isCurrentUser: false },
  ],
  referrals: [
    { rank: 1, address: '0xaaaa...bbbb', value: '45 referrals', secondaryValue: '890K PLS volume', isCurrentUser: false },
    { rank: 2, address: '0xcccc...dddd', value: '32 referrals', secondaryValue: '650K PLS volume', isCurrentUser: false },
    { rank: 3, address: '0xeeee...ffff', value: '28 referrals', secondaryValue: '420K PLS volume', isCurrentUser: false },
  ],
  roi: [
    { rank: 1, address: '0x1111...2222', value: '+285%', secondaryValue: '500K PLS traded', isCurrentUser: false },
    { rank: 2, address: '0x3333...4444', value: '+156%', secondaryValue: '750K PLS traded', isCurrentUser: false },
    { rank: 3, address: '0x5555...6666', value: '+98%', secondaryValue: '1.2M PLS traded', isCurrentUser: false },
  ],
}

export function LeaderboardPage() {
  const navigate = useNavigate()
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('volume')
  const [copiedLink, setCopiedLink] = useState(false)

  // Contract is deployed
  const contractDeployed = true

  // User stats
  const { data: userStats } = useReadContract({
    address: contractDeployed ? LEADERBOARD_ADDRESS : undefined,
    abi: LEADERBOARD_ABI,
    functionName: 'getUserStats',
    args: userAddress ? [userAddress] : undefined,
  })

  // Top volume traders
  const { data: volumeData } = useReadContract({
    address: contractDeployed ? LEADERBOARD_ADDRESS : undefined,
    abi: LEADERBOARD_ABI,
    functionName: 'getTopVolumeTraders',
    args: [50n],
  })

  // Top referrers
  const { data: referrersData } = useReadContract({
    address: contractDeployed ? LEADERBOARD_ADDRESS : undefined,
    abi: LEADERBOARD_ABI,
    functionName: 'getTopReferrers',
    args: [50n],
  })

  // Top ROI
  const { data: roiData } = useReadContract({
    address: contractDeployed ? LEADERBOARD_ADDRESS : undefined,
    abi: LEADERBOARD_ABI,
    functionName: 'getTopROITraders',
    args: [50n],
  })

  // Claim rewards
  const { writeContract, data: claimHash, isPending: isClaiming } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: _claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })
  void _claimSuccess // Used for transaction confirmation tracking

  const handleClaimRewards = () => {
    if (!contractDeployed) return
    writeContract({
      address: LEADERBOARD_ADDRESS,
      abi: LEADERBOARD_ABI,
      functionName: 'claimReferralRewards',
    })
  }

  // Generate referral link
  const referralLink = useMemo(() => {
    if (!userAddress) return ''
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pump.fud'
    return `${baseUrl}/?ref=${userAddress}`
  }, [userAddress])

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Format data for display
  const leaderboardData = useMemo((): LeaderboardEntry[] => {
    if (!contractDeployed) {
      return PLACEHOLDER_DATA[activeTab]
    }

    const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
    const formatVolume = (vol: bigint) => {
      const num = Number(formatEther(vol))
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M PLS`
      if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K PLS`
      return `${num.toFixed(0)} PLS`
    }

    if (activeTab === 'volume' && volumeData) {
      const [addresses, volumes] = volumeData
      return addresses.map((addr, i) => ({
        rank: i + 1,
        address: formatAddress(addr),
        value: formatVolume(volumes[i]),
        isCurrentUser: addr.toLowerCase() === userAddress?.toLowerCase(),
      }))
    }

    if (activeTab === 'referrals' && referrersData) {
      const [addresses, counts, volumes] = referrersData
      return addresses.map((addr, i) => ({
        rank: i + 1,
        address: formatAddress(addr),
        value: `${counts[i]} referrals`,
        secondaryValue: formatVolume(volumes[i]),
        isCurrentUser: addr.toLowerCase() === userAddress?.toLowerCase(),
      }))
    }

    if (activeTab === 'roi' && roiData) {
      const [addresses, rois, volumes] = roiData
      return addresses.map((addr, i) => ({
        rank: i + 1,
        address: formatAddress(addr),
        value: `${Number(rois[i]) >= 0 ? '+' : ''}${(Number(rois[i]) / 100).toFixed(1)}%`,
        secondaryValue: formatVolume(volumes[i]),
        isCurrentUser: addr.toLowerCase() === userAddress?.toLowerCase(),
      }))
    }

    return PLACEHOLDER_DATA[activeTab]
  }, [activeTab, volumeData, referrersData, roiData, userAddress, contractDeployed])

  const pendingRewards = useMemo(() => {
    if (!userStats) return 0n
    return userStats.pendingReferral
  }, [userStats])

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'volume', label: 'Volume Kings', icon: '👑' },
    { key: 'referrals', label: 'Top Referrers', icon: '🔗' },
    { key: 'roi', label: 'Best Traders', icon: '📈' },
  ]

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'rgba(255,215,0,0.15)', border: '#ffd700', text: '#ffd700' }
    if (rank === 2) return { bg: 'rgba(192,192,192,0.15)', border: '#c0c0c0', text: '#c0c0c0' }
    if (rank === 3) return { bg: 'rgba(205,127,50,0.15)', border: '#cd7f32', text: '#cd7f32' }
    return { bg: '#1a1a1a', border: '#2a2a2a', text: '#888' }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#0f0f0f',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Fantasy Tree Maze Background - Quest Journey Theme */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'url(/backgrounds/stained-glass.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'brightness(0.6)',
        zIndex: 0,
      }} />
      <div style={{
        position: 'fixed',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 30%, rgba(138,43,226,0.15) 0%, transparent 50%),
          linear-gradient(180deg, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.7) 100%)
        `,
        zIndex: 0,
      }} />

      {/* Header */}
      <header style={{
        position: 'relative',
        zIndex: 1,
        height: '60px',
        backgroundColor: 'rgba(26,26,26,0.95)',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '28px' }}>🔥</span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '20px', fontWeight: 700, color: '#dc143c', letterSpacing: '0.1em' }}>
              PUMP.FUD
            </span>
          </div>
          <div style={{ width: '1px', height: '30px', backgroundColor: '#2a2a2a' }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>🏆 Leaderboard</span>
        </div>
        <ConnectButton />
      </header>

      {/* Main Content */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, overflow: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Your Stats & Referral Section */}
          {isConnected && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '24px',
            }}>
              {/* Your Stats */}
              <div style={{
                background: 'rgba(26,26,26,0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#888', marginBottom: '16px', margin: 0 }}>
                  📊 Your Stats
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>
                      {userStats ? `${(Number(formatEther(userStats.totalVolume)) / 1000).toFixed(1)}K` : '0'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Volume (PLS)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#a855f7' }}>
                      {userStats ? String(userStats.referralCount) : '0'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Referrals</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>
                      {userStats ? String(userStats.tradeCount) : '0'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Trades</div>
                  </div>
                </div>
              </div>

              {/* Referral Link & Rewards */}
              <div style={{
                background: 'rgba(26,26,26,0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#888', marginBottom: '16px', margin: 0 }}>
                  🔗 Your Referral Link
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    style={{
                      flex: 1,
                      backgroundColor: '#252525',
                      border: '1px solid #3a3a3a',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: '#888',
                    }}
                  />
                  <button
                    onClick={copyReferralLink}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: copiedLink ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                      border: `1px solid ${copiedLink ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)'}`,
                      borderRadius: '8px',
                      color: copiedLink ? '#22c55e' : '#a855f7',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copiedLink ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>

                {/* Pending Rewards */}
                {pendingRewards > 0n && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(34,197,94,0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#888' }}>Pending Rewards</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#22c55e' }}>
                        {formatEther(pendingRewards)} PLS
                      </div>
                    </div>
                    <button
                      onClick={handleClaimRewards}
                      disabled={isClaiming || isConfirming || !contractDeployed}
                      style={{
                        padding: '10px 20px',
                        background: (isClaiming || isConfirming) ? '#333' : 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: (isClaiming || isConfirming) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isClaiming || isConfirming ? '⏳ Claiming...' : '💰 Claim'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '20px',
            padding: '4px',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  backgroundColor: activeTab === tab.key ? '#252525' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contract Not Deployed Notice */}
          {!contractDeployed && (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              <span style={{ color: '#f97316', fontSize: '13px' }}>
                ⚠️ Leaderboard contract pending deployment. Showing preview data.
              </span>
            </div>
          )}

          {/* Leaderboard Table */}
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            overflow: 'hidden',
          }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 150px 150px',
              padding: '14px 20px',
              backgroundColor: '#151515',
              borderBottom: '1px solid #2a2a2a',
              fontSize: '11px',
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
            }}>
              <div>Rank</div>
              <div>Wallet</div>
              <div style={{ textAlign: 'right' }}>
                {activeTab === 'volume' && 'Volume'}
                {activeTab === 'referrals' && 'Referrals'}
                {activeTab === 'roi' && 'ROI'}
              </div>
              <div style={{ textAlign: 'right' }}>
                {activeTab === 'volume' && 'Trades'}
                {activeTab === 'referrals' && 'Volume'}
                {activeTab === 'roi' && 'Volume'}
              </div>
            </div>

            {/* Table Body */}
            {leaderboardData.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#666' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.5 }}>🏆</span>
                <p>No data yet. Start trading to appear on the leaderboard!</p>
              </div>
            ) : (
              leaderboardData.map((entry) => {
                const style = getRankStyle(entry.rank)
                return (
                  <div
                    key={entry.rank}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 150px 150px',
                      padding: '16px 20px',
                      backgroundColor: entry.isCurrentUser ? 'rgba(34,197,94,0.1)' : style.bg,
                      borderBottom: '1px solid #252525',
                      borderLeft: entry.isCurrentUser ? '3px solid #22c55e' : entry.rank <= 3 ? `3px solid ${style.border}` : 'none',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: entry.rank <= 3 ? style.text : '#666',
                    }}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        color: entry.isCurrentUser ? '#22c55e' : '#fff',
                        fontWeight: entry.isCurrentUser ? 700 : 400,
                      }}>
                        {entry.address}
                      </span>
                      {entry.isCurrentUser && (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: 'rgba(34,197,94,0.2)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#22c55e',
                        }}>
                          YOU
                        </span>
                      )}
                    </div>
                    <div style={{
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: activeTab === 'roi'
                        ? (entry.value.startsWith('+') ? '#22c55e' : '#ef4444')
                        : '#22c55e',
                    }}>
                      {entry.value}
                    </div>
                    <div style={{
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#666',
                    }}>
                      {entry.secondaryValue || '-'}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* How It Works */}
          <div style={{
            marginTop: '24px',
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px', margin: 0 }}>
              ℹ️ How Leaderboards Work
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginTop: '16px',
            }}>
              <div>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>👑</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Volume Kings</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  Total PLS value of all your trades (buys + sells). More volume = higher rank.
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔗</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Top Referrers</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  Share your link. When referrals trade, you earn 10% of their fees!
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>📈</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Best Traders</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  ROI = (Sells - Buys) / Buys. Must have 100+ PLS volume and 3+ trades.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
