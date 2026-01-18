import { Link } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

interface TokenCardProps {
  tokenAddress: `0x${string}`
}

export function TokenCard({ tokenAddress }: TokenCardProps) {
  const { data: tokenData } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress],
  })

  if (!tokenData) {
    return (
      <div className="token-card p-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-xl bg-pump-dark-border" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-pump-dark-border rounded w-3/4" />
            <div className="h-4 bg-pump-dark-border rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  const { creator, name, symbol, description, imageUri, reserveBalance, status, createdAt } = tokenData
  const graduationThreshold = 50_000_000n * 10n ** 18n // 50M PLS
  const progress = Number((reserveBalance * 100n) / graduationThreshold)
  const marketCap = Number(formatEther(reserveBalance))
  const isGraduated = Number(status) === 1
  const isNew = Date.now() / 1000 - Number(createdAt) < 3600 // Less than 1 hour old

  return (
    <Link to={`/token/${tokenAddress}`} className="token-card group">
      {/* Header */}
      <div className="p-4 border-b border-pump-dark-border/50">
        <div className="flex items-start gap-3">
          {/* Token Image */}
          <div className="relative">
            {imageUri ? (
              <img
                src={imageUri}
                alt={name}
                className="w-14 h-14 rounded-xl object-cover ring-2 ring-pump-dark-border group-hover:ring-pump-green transition-all"
                onError={(e) => {
                  e.currentTarget.src = ''
                  e.currentTarget.onerror = null
                  e.currentTarget.className = 'hidden'
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pump-green/30 to-pump-green-dark/30 flex items-center justify-center ring-2 ring-pump-dark-border group-hover:ring-pump-green transition-all">
                <span className="text-3xl">💊</span>
              </div>
            )}
            {isNew && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-pump-green rounded-full animate-pulse" />
            )}
          </div>

          {/* Token Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg truncate group-hover:text-pump-green transition-colors">
                {name}
              </h3>
              {isGraduated && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-tier-3/20 text-tier-3 rounded-full uppercase">
                  Graduated
                </span>
              )}
            </div>
            <p className="text-pump-green font-mono text-sm font-medium">${symbol}</p>
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-lg text-xs font-bold ${
            isGraduated
              ? 'bg-tier-3/20 text-tier-3 border border-tier-3/30'
              : 'bg-pump-green/20 text-pump-green border border-pump-green/30 animate-pulse'
          }`}>
            {isGraduated ? '🎓 DEX' : '🔥 LIVE'}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="px-4 py-3 border-b border-pump-dark-border/50">
          <p className="text-sm text-pump-white-muted line-clamp-2 leading-relaxed">{description}</p>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* Market Cap */}
        <div className="flex justify-between items-center">
          <span className="text-pump-white-muted text-sm">Market Cap</span>
          <span className="font-mono font-bold text-pump-green text-lg">
            {marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS
          </span>
        </div>

        {/* Progress Bar */}
        {!isGraduated && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-pump-white-muted">Progress to Graduation</span>
              <span className="text-pump-green font-mono font-bold">{Math.min(progress, 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-pump-dark rounded-full overflow-hidden ring-1 ring-pump-dark-border">
              <div
                className="progress-bar h-full relative"
                style={{ width: `${Math.min(progress, 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>
            <div className="text-xs text-pump-dark-border text-center">
              {(50_000_000 - marketCap).toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS to graduation
            </div>
          </div>
        )}

        {/* Creator */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-pump-white-muted">Creator</span>
          <span className="text-pump-white font-mono">
            {creator.slice(0, 6)}...{creator.slice(-4)}
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4 pt-0">
        <div className="w-full py-3 rounded-xl bg-gradient-to-r from-pump-green/10 to-pump-green-dark/10 border border-pump-green/30 text-pump-green font-display font-bold text-center group-hover:from-pump-green group-hover:to-pump-green-dark group-hover:text-pump-dark transition-all">
          TRADE NOW
        </div>
      </div>
    </Link>
  )
}
