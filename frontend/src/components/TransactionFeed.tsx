import { useState, useEffect, useRef, useCallback } from 'react'
import { useWatchContractEvent, usePublicClient } from 'wagmi'
import { formatEther, parseAbiItem } from 'viem'
import { PUMP_FUD_ADDRESS } from '../config/wagmi'

interface Transaction {
  id: string
  type: 'buy' | 'sell'
  amount: string
  price: string
  wallet: `0x${string}`
  timestamp: number
  txHash: `0x${string}`
}

// RL-007: Wallet tracking storage key
const TRACKED_WALLETS_KEY = 'pump-phud-tracked-wallets'

// Load tracked wallets from localStorage
function loadTrackedWallets(): Set<string> {
  try {
    const stored = localStorage.getItem(TRACKED_WALLETS_KEY)
    if (stored) {
      const wallets = JSON.parse(stored) as string[]
      console.log('[RALPH RL-007] Tracked wallets loaded:', wallets.length)
      return new Set(wallets.map(w => w.toLowerCase()))
    }
  } catch (error) {
    console.error('[RALPH RL-007] Failed to load tracked wallets:', error)
  }
  return new Set()
}

// Save tracked wallets to localStorage
function saveTrackedWallets(wallets: Set<string>) {
  try {
    localStorage.setItem(TRACKED_WALLETS_KEY, JSON.stringify(Array.from(wallets)))
    console.log('[RALPH RL-007] Tracked wallets saved:', wallets.size)
  } catch (error) {
    console.error('[RALPH RL-007] Failed to save tracked wallets:', error)
  }
}

interface TransactionFeedProps {
  tokenAddress: `0x${string}`
  tokenSymbol: string
  reserveBalance: bigint
  tokensSold: bigint
}

const PULSESCAN_URL = 'https://scan.pulsechain.com'

// ERC20 Transfer event
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

export function TransactionFeed({
  tokenAddress,
  tokenSymbol,
  reserveBalance,
  tokensSold,
}: TransactionFeedProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [trackedWallets, setTrackedWallets] = useState<Set<string>>(() => loadTrackedWallets())
  const [showTrackedOnly, setShowTrackedOnly] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const publicClient = usePublicClient()

  // RL-007: Toggle wallet tracking
  const toggleWalletTracking = useCallback((wallet: string) => {
    const normalizedWallet = wallet.toLowerCase()
    setTrackedWallets(prev => {
      const updated = new Set(prev)
      if (updated.has(normalizedWallet)) {
        updated.delete(normalizedWallet)
        console.log('[RALPH RL-007] Wallet untracked:', wallet)
      } else {
        updated.add(normalizedWallet)
        console.log('[RALPH RL-007] Wallet tracked:', wallet)
      }
      saveTrackedWallets(updated)
      return updated
    })
  }, [])

  // RL-007: Check if wallet is tracked
  const isWalletTracked = useCallback((wallet: string) => {
    return trackedWallets.has(wallet.toLowerCase())
  }, [trackedWallets])

  // Calculate current price from bonding curve
  const currentPrice = (() => {
    if (!tokensSold || tokensSold === 0n) return 0.00001
    if (!reserveBalance || reserveBalance === 0n) return 0.00001
    const sold = Number(formatEther(tokensSold))
    const reserve = Number(formatEther(reserveBalance))
    if (sold === 0) return 0.00001
    return reserve / sold
  })()

  // Play notification sound
  const playSound = useCallback(() => {
    if (!soundEnabled) return
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch {
      // Audio not supported
    }
  }, [soundEnabled])

  // Add transaction to feed
  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(prev => {
      // Prevent duplicates
      if (prev.some(t => t.id === tx.id)) return prev
      playSound()
      // Keep only last 50 transactions
      return [tx, ...prev].slice(0, 50)
    })
  }, [playSound])

  // Watch Transfer events
  useWatchContractEvent({
    address: tokenAddress,
    abi: [TRANSFER_EVENT],
    eventName: 'Transfer',
    onLogs(logs) {
      logs.forEach((log) => {
        const typedLog = log as unknown as {
          args: { from: `0x${string}`; to: `0x${string}`; value: bigint }
          transactionHash: `0x${string}`
          logIndex: number
        }
        const args = typedLog.args
        if (!args) return

        const { from, to, value } = args
        const isBuy = from.toLowerCase() === PUMP_FUD_ADDRESS.toLowerCase()
        const isSell = to.toLowerCase() === PUMP_FUD_ADDRESS.toLowerCase()

        if (!isBuy && !isSell) return // Skip regular transfers

        const tx: Transaction = {
          id: `${typedLog.transactionHash}-${typedLog.logIndex}`,
          type: isBuy ? 'buy' : 'sell',
          amount: formatEther(value),
          price: currentPrice.toFixed(8),
          wallet: isBuy ? to : from,
          timestamp: Date.now(),
          txHash: typedLog.transactionHash,
        }

        addTransaction(tx)
      })
    },
  })

  // Fetch historical transactions on mount
  useEffect(() => {
    if (!publicClient || !tokenAddress) return

    const fetchHistorical = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber()
        const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n

        const logs = await publicClient.getLogs({
          address: tokenAddress,
          event: TRANSFER_EVENT,
          fromBlock,
          toBlock: 'latest',
        })

        const historicalTxs: Transaction[] = []

        for (const log of logs.slice(-20)) { // Last 20 transfers
          const args = log.args as { from: `0x${string}`; to: `0x${string}`; value: bigint } | undefined
          if (!args) continue

          const { from, to, value } = args
          const isBuy = from.toLowerCase() === PUMP_FUD_ADDRESS.toLowerCase()
          const isSell = to.toLowerCase() === PUMP_FUD_ADDRESS.toLowerCase()

          if (!isBuy && !isSell) continue

          // Get block timestamp
          let timestamp = Date.now()
          try {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
            timestamp = Number(block.timestamp) * 1000
          } catch {
            // Use current time as fallback
          }

          historicalTxs.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: isBuy ? 'buy' : 'sell',
            amount: formatEther(value),
            price: currentPrice.toFixed(8),
            wallet: isBuy ? to : from,
            timestamp,
            txHash: log.transactionHash!,
          })
        }

        // Sort by timestamp descending
        historicalTxs.sort((a, b) => b.timestamp - a.timestamp)
        setTransactions(historicalTxs)
      } catch (error) {
        console.error('Failed to fetch historical transactions:', error)
      }
    }

    fetchHistorical()
  }, [publicClient, tokenAddress, currentPrice])

  // Auto-scroll
  useEffect(() => {
    if (!isPaused && feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }, [transactions, isPaused])

  // Format wallet address
  const formatWallet = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`

  // Format time
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(timestamp).toLocaleDateString()
  }

  // Format amount
  const formatAmount = (amount: string) => {
    const num = parseFloat(amount)
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(2)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '300px',
      backgroundColor: 'rgba(26,26,26,0.95)',
      borderRadius: '12px',
      border: '1px solid rgba(0,255,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📜</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Transaction Feed
          </span>
          <span style={{
            padding: '2px 8px',
            backgroundColor: 'rgba(0,255,0,0.15)',
            borderRadius: '10px',
            fontSize: '10px',
            color: '#00ff00',
            fontWeight: 600,
          }}>
            LIVE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* RL-007: Tracked Only Filter */}
          {trackedWallets.size > 0 && (
            <button
              onClick={() => setShowTrackedOnly(!showTrackedOnly)}
              style={{
                padding: '4px 8px',
                backgroundColor: showTrackedOnly ? 'rgba(168,85,247,0.2)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: showTrackedOnly ? '#c084fc' : '#666',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={showTrackedOnly ? 'Show all transactions' : 'Show tracked wallets only'}
            >
              👁️ {trackedWallets.size}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '4px 8px',
              backgroundColor: soundEnabled ? 'rgba(0,255,0,0.2)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: soundEnabled ? '#00ff00' : '#666',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title={soundEnabled ? 'Mute notifications' : 'Enable sound notifications'}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>

          {/* Pause Toggle */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              padding: '4px 8px',
              backgroundColor: isPaused ? 'rgba(239,68,68,0.2)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: isPaused ? '#ef4444' : '#666',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {isPaused ? '⏸️' : '▶️'}
          </button>
        </div>
      </div>

      {/* Column Headers - RL-007: Updated grid for tracking button */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 90px 120px 70px',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '10px',
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
      }}>
        <span>Type</span>
        <span>Amount</span>
        <span>Price</span>
        <span>Wallet</span>
        <span>Time</span>
      </div>

      {/* Transaction List */}
      <div
        ref={feedRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* RL-007: Filter transactions by tracked wallets if enabled */}
        {(() => {
          const filteredTxs = showTrackedOnly
            ? transactions.filter(tx => isWalletTracked(tx.wallet))
            : transactions

          if (filteredTxs.length === 0) {
            return (
              <div style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: '#666',
                fontSize: '12px',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                  {showTrackedOnly ? '👁️' : '📊'}
                </div>
                <div>
                  {showTrackedOnly
                    ? 'No transactions from tracked wallets'
                    : 'Waiting for transactions...'}
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#444' }}>
                  {showTrackedOnly
                    ? 'Track a wallet by clicking the ★ next to their address'
                    : `Buy or sell ${tokenSymbol} to see activity`}
                </div>
              </div>
            )
          }

          return filteredTxs.map((tx, index) => {
            const isTracked = isWalletTracked(tx.wallet)
            return (
              <div
                key={tx.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 90px 120px 70px',
                  gap: '8px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  backgroundColor: isTracked
                    ? 'rgba(168,85,247,0.1)'
                    : index === 0 && !isPaused
                      ? tx.type === 'buy' ? 'rgba(0,255,0,0.08)' : 'rgba(239,68,68,0.08)'
                      : 'transparent',
                  transition: 'background-color 0.3s ease',
                  animation: index === 0 && !isPaused ? 'fadeIn 0.3s ease' : 'none',
                  borderLeft: isTracked ? '2px solid #c084fc' : '2px solid transparent',
                }}
              >
              {/* Type */}
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: tx.type === 'buy' ? '#00ff00' : '#ef4444',
                }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tx.type === 'buy' ? '#00ff00' : '#ef4444',
                  textTransform: 'uppercase',
                }}>
                  {tx.type}
                </span>
              </span>

              {/* Amount */}
              <span style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {formatAmount(tx.amount)} {tokenSymbol}
              </span>

              {/* Price */}
              <span style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#888',
              }}>
                {tx.price} PLS
              </span>

              {/* Wallet - RL-007: Added tracking button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWalletTracking(tx.wallet)
                  }}
                  style={{
                    padding: '2px 4px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: isTracked ? '#c084fc' : '#444',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isTracked) e.currentTarget.style.color = '#c084fc'
                  }}
                  onMouseLeave={(e) => {
                    if (!isTracked) e.currentTarget.style.color = '#444'
                  }}
                  title={isTracked ? 'Stop tracking this wallet' : 'Track this wallet'}
                >
                  {isTracked ? '★' : '☆'}
                </button>
                <a
                  href={`${PULSESCAN_URL}/address/${tx.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: isTracked ? '#c084fc' : '#888',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#00ff00'
                    e.currentTarget.style.textDecoration = 'underline'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isTracked ? '#c084fc' : '#888'
                    e.currentTarget.style.textDecoration = 'none'
                  }}
                  title={`View ${tx.wallet} on PulseScan`}
                >
                  {formatWallet(tx.wallet)}
                </a>
              </div>

              {/* Time */}
              <a
                href={`${PULSESCAN_URL}/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10px',
                  color: '#666',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#00ff00'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#666'
                }}
                title="View transaction on PulseScan"
              >
                {formatTime(tx.timestamp)}
              </a>
            </div>
            )
          })
        })()}
      </div>

      {/* Footer Stats - RL-007: Added tracked wallet count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(0,0,0,0.3)',
        fontSize: '10px',
        color: '#666',
      }}>
        <span>
          {transactions.filter(t => t.type === 'buy').length} buys /{' '}
          {transactions.filter(t => t.type === 'sell').length} sells
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {trackedWallets.size > 0 && (
            <span style={{ color: '#c084fc' }}>
              ★ {trackedWallets.size} tracked
            </span>
          )}
          <span>
            {transactions.length} transactions
          </span>
        </span>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
