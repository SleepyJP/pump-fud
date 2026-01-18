import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useReadContract, useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'
import { TradePanel } from '../components/TradePanel'
import { ChatPanel } from '../components/ChatPanel'

// Mock trade history for demo
const mockTrades = [
  { type: 'buy', amount: '125,000', pls: '1,250', user: '0x1234...5678', time: '2m ago' },
  { type: 'sell', amount: '50,000', pls: '480', user: '0xabcd...efgh', time: '5m ago' },
  { type: 'buy', amount: '300,000', pls: '3,100', user: '0x9876...5432', time: '8m ago' },
  { type: 'buy', amount: '75,000', pls: '720', user: '0x1111...2222', time: '12m ago' },
  { type: 'sell', amount: '200,000', pls: '1,850', user: '0x3333...4444', time: '15m ago' },
]

// Mock comments for demo
const mockComments = [
  { user: '0x1234...5678', username: 'whale.pls', msg: 'LFG! This is going to moon!', time: '2m ago' },
  { user: '0xabcd...efgh', username: 'degen_trader', msg: 'Just aped in hard', time: '5m ago' },
  { user: '0x9876...5432', username: 'anon', msg: 'Chart looking bullish af', time: '8m ago' },
]

// Mock top holders
const mockHolders = [
  { address: '0x1234...5678', percent: 4.2 },
  { address: '0xabcd...efgh', percent: 3.1 },
  { address: '0x9876...5432', percent: 2.8 },
  { address: '0x1111...2222', percent: 2.1 },
  { address: '0x3333...4444', percent: 1.9 },
]

export function TokenPage() {
  const { address } = useParams<{ address: string }>()
  const { isConnected } = useAccount()
  const [chatOpen, setChatOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'thread' | 'trades'>('thread')

  const tokenAddress = address as `0x${string}`

  // Get token info using getTokenByAddress
  const { data: tokenData, isLoading } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress],
    query: { enabled: !!address },
  })

  // Get graduation threshold
  const { data: graduationThreshold } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'graduationThreshold',
  })

  if (isLoading || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pump-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-pump-white-muted">Loading token...</p>
        </div>
      </div>
    )
  }

  const { creator, name, symbol, description, imageUri, reserveBalance, tokensSold, status } = tokenData
  const isGraduated = Number(status) === 1
  const threshold = graduationThreshold || 50_000_000n * 10n ** 18n
  const progress = Number((reserveBalance * 100n) / threshold)
  const marketCap = Number(formatEther(reserveBalance))

  return (
    <div className="min-h-screen p-4">
      <div className="flex gap-4">
        {/* LEFT COLUMN - Chart & Activity */}
        <div className="flex-1 space-y-4">
          {/* Token Header */}
          <div className="flex items-center gap-4">
            {imageUri ? (
              <img src={imageUri} alt={name} className="w-12 h-12 rounded-lg object-cover" onError={(e) => { e.currentTarget.src = '/images/logo-circle.png' }} />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-pump-dark-lighter flex items-center justify-center">
                <img src="/images/logo-circle.png" alt="" className="w-10 h-10" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xl">{name}</h1>
                <span className="text-pump-green font-mono">${symbol}</span>
                {isGraduated && <span className="px-2 py-0.5 text-xs bg-tier-3/20 text-tier-3 rounded">🎓</span>}
              </div>
              <div className="text-pump-white-muted text-sm">
                Created by <span className="text-pump-green">{creator.slice(0, 6)}...{creator.slice(-4)}</span>
              </div>
            </div>
          </div>

          {/* Price Display */}
          <div className="text-3xl font-mono font-bold text-pump-green">
            ${marketCap >= 1000 ? `${(marketCap / 1000).toFixed(1)}K` : marketCap.toFixed(0)} PLS
          </div>

          {/* Chart Placeholder */}
          <div className="bg-pump-dark-lighter rounded-xl border border-pump-dark-border overflow-hidden">
            {/* Chart Header */}
            <div className="flex items-center justify-between p-3 border-b border-pump-dark-border">
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs bg-pump-dark rounded text-pump-white-muted">1m</button>
                <button className="px-3 py-1 text-xs bg-pump-green/20 text-pump-green rounded">5m</button>
                <button className="px-3 py-1 text-xs bg-pump-dark rounded text-pump-white-muted">15m</button>
                <button className="px-3 py-1 text-xs bg-pump-dark rounded text-pump-white-muted">1H</button>
              </div>
              <div className="text-xs text-pump-dark-border">📊 TradingView</div>
            </div>

            {/* Chart Area - Placeholder with gradient */}
            <div className="h-80 bg-pump-dark relative overflow-hidden">
              {/* Fake candlestick chart visualization */}
              <div className="absolute inset-0 flex items-end justify-around px-4 pb-8">
                {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 95, 88, 92, 100].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-2 ${i % 3 === 0 ? 'bg-red-500' : 'bg-pump-green'}`}
                      style={{ height: `${h * 2}px` }}
                    />
                  </div>
                ))}
              </div>
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t border-pump-dark-border/30" />
                ))}
              </div>
              {/* Chart coming soon overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-pump-dark/50">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <div className="text-pump-white-muted">Live Chart Coming Soon</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs: Thread / Trades */}
          <div className="flex gap-2 border-b border-pump-dark-border">
            <button
              onClick={() => setActiveTab('thread')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'thread'
                  ? 'border-pump-green text-pump-green'
                  : 'border-transparent text-pump-white-muted hover:text-white'
              }`}
            >
              Thread
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'trades'
                  ? 'border-pump-green text-pump-green'
                  : 'border-transparent text-pump-white-muted hover:text-white'
              }`}
            >
              Trades
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'thread' ? (
            <div className="space-y-4">
              {/* Post Comment */}
              {isConnected && (
                <div className="bg-pump-dark-lighter rounded-xl p-4">
                  <textarea
                    placeholder="Post a reply..."
                    className="w-full bg-pump-dark border border-pump-dark-border rounded-lg px-4 py-3 text-white placeholder-pump-dark-border focus:border-pump-green outline-none resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <button className="px-4 py-2 rounded-lg bg-pump-green text-pump-dark font-medium text-sm">
                      Post
                    </button>
                  </div>
                </div>
              )}

              {/* Comments */}
              {mockComments.map((comment, i) => (
                <div key={i} className="bg-pump-dark-lighter rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-pump-dark flex items-center justify-center text-pump-green font-bold">
                      {comment.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-pump-green font-medium">{comment.username}</span>
                        <span className="text-pump-dark-border text-xs">{comment.time}</span>
                      </div>
                      <p className="text-white text-sm">{comment.msg}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-pump-dark-lighter rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-pump-white-muted text-xs border-b border-pump-dark-border">
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">PLS</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTrades.map((trade, i) => (
                    <tr key={i} className="border-b border-pump-dark-border/50 text-sm">
                      <td className={`p-3 font-medium ${trade.type === 'buy' ? 'text-pump-green' : 'text-red-500'}`}>
                        {trade.type.toUpperCase()}
                      </td>
                      <td className="p-3 font-mono">{trade.amount}</td>
                      <td className="p-3 font-mono">{trade.pls}</td>
                      <td className="p-3 text-pump-white-muted">{trade.user}</td>
                      <td className="p-3 text-pump-dark-border">{trade.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Token Info & Trade */}
        <div className="w-80 space-y-4">
          {/* Token Card */}
          <div className="bg-pump-dark-lighter rounded-xl p-4 border border-pump-dark-border">
            <div className="flex items-center gap-3 mb-4">
              {imageUri ? (
                <img src={imageUri} alt={name} className="w-16 h-16 rounded-xl object-cover" onError={(e) => { e.currentTarget.src = '/images/logo-circle.png' }} />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-pump-dark flex items-center justify-center">
                  <img src="/images/logo-circle.png" alt="" className="w-12 h-12" />
                </div>
              )}
              <div>
                <h3 className="font-bold">{name}</h3>
                <p className="text-pump-green font-mono text-sm">${symbol}</p>
              </div>
            </div>

            {description && (
              <p className="text-pump-white-muted text-sm mb-4 line-clamp-3">{description}</p>
            )}

            {/* Quick Stats */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pump-white-muted">Market Cap</span>
                <span className="text-pump-green font-mono">{marketCap.toLocaleString()} PLS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pump-white-muted">Tokens Sold</span>
                <span className="font-mono">{Number(formatEther(tokensSold)).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Trade Panel */}
          <TradePanel
            tokenAddress={tokenAddress}
            tokenSymbol={symbol}
            isGraduated={isGraduated}
          />

          {/* Bonding Curve Progress */}
          {!isGraduated && (
            <div className="bg-pump-dark-lighter rounded-xl p-4 border border-pump-dark-border">
              <h4 className="font-medium text-sm mb-3">Bonding Curve Progress</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-pump-white-muted">{progress.toFixed(1)}%</span>
                  <span className="text-pump-green">{marketCap.toLocaleString()} / 50M PLS</span>
                </div>
                <div className="h-3 bg-pump-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pump-green to-pump-green-light"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-pump-dark-border">
                  Graduate to PulseX at 50M PLS
                </p>
              </div>
            </div>
          )}

          {/* Top Holders */}
          <div className="bg-pump-dark-lighter rounded-xl p-4 border border-pump-dark-border">
            <h4 className="font-medium text-sm mb-3">Holder Distribution</h4>
            <div className="space-y-2">
              {mockHolders.map((holder, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-pump-dark-border">{i + 1}.</span>
                    <span className="text-pump-white-muted font-mono">{holder.address}</span>
                  </div>
                  <span className="text-pump-green">{holder.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex gap-2">
            <a
              href={`https://scan.pulsechain.com/address/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 rounded-lg bg-pump-dark-lighter text-center text-sm text-pump-white-muted hover:text-white transition-colors"
            >
              PulseScan
            </a>
            <button
              onClick={() => setChatOpen(true)}
              className="flex-1 py-2 rounded-lg bg-pump-green/20 text-center text-sm text-pump-green hover:bg-pump-green/30 transition-colors"
            >
              💬 Live Chat
            </button>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        tokenAddress={tokenAddress}
        tokenSymbol={symbol}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  )
}
