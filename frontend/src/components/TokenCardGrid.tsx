import { Link } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

interface TokenCardGridProps {
  tokenAddress: `0x${string}`
}

export function TokenCardGrid({ tokenAddress }: TokenCardGridProps) {
  const { data: tokenData } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getTokenByAddress',
    args: [tokenAddress],
  })

  if (!tokenData) {
    return (
      <div className="bg-pump-dark-lighter rounded-xl p-4 animate-pulse">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-pump-dark-border" />
          <div className="flex-1">
            <div className="h-4 bg-pump-dark-border rounded w-3/4 mb-2" />
            <div className="h-3 bg-pump-dark-border rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  const { creator, name, symbol, description, imageUri, reserveBalance, status, createdAt } = tokenData
  const marketCap = Number(formatEther(reserveBalance))
  const isGraduated = Number(status) === 1
  const isNew = Date.now() / 1000 - Number(createdAt) < 3600

  return (
    <Link
      to={`/token/${tokenAddress}`}
      className="block bg-pump-dark-lighter rounded-xl p-4 border border-transparent hover:border-pump-green transition-all group"
    >
      {/* Header with image and info */}
      <div className="flex items-start gap-3 mb-3">
        {/* Token Image */}
        <div className="relative">
          {imageUri ? (
            <img
              src={imageUri}
              alt={name}
              className="w-12 h-12 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.src = '/images/logo-circle.png'
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-pump-dark flex items-center justify-center">
              <img src="/images/logo-circle.png" alt="" className="w-10 h-10" />
            </div>
          )}
          {isNew && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-pump-green rounded-full animate-pulse" />
          )}
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white truncate group-hover:text-pump-green transition-colors">
              {name}
            </h3>
            {isGraduated && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-tier-3/20 text-tier-3 rounded">
                🎓
              </span>
            )}
          </div>
          <p className="text-pump-green text-sm font-mono">${symbol}</p>
        </div>

        {/* Market Cap Badge */}
        <div className="text-right">
          <div className="text-pump-green text-sm font-mono font-medium">
            {marketCap >= 1000000
              ? `${(marketCap / 1000000).toFixed(1)}M`
              : marketCap >= 1000
              ? `${(marketCap / 1000).toFixed(1)}K`
              : marketCap.toFixed(0)}
          </div>
          <div className="text-pump-dark-border text-xs">PLS</div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-pump-white-muted text-xs line-clamp-2 mb-3 leading-relaxed">
          {description}
        </p>
      )}

      {/* Creator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-pump-dark-border">
          by {creator.slice(0, 6)}...{creator.slice(-4)}
        </span>
        {!isGraduated && (
          <span className="text-pump-green animate-pulse">● LIVE</span>
        )}
      </div>
    </Link>
  )
}
