import { useReadContract } from 'wagmi'
import { Link } from 'react-router-dom'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

// Mock livestream data for demo
const mockStreams = [
  { id: 1, title: 'PUMP IT UP!', viewers: 1243, thumbnail: '/images/logo-circle.png' },
  { id: 2, title: 'Trading Session', viewers: 856, thumbnail: '/images/logo-circle.png' },
  { id: 3, title: 'New Token Launch', viewers: 2100, thumbnail: '/images/logo-circle.png' },
  { id: 4, title: 'AMA Live', viewers: 543, thumbnail: '/images/logo-circle.png' },
  { id: 5, title: 'Chart Analysis', viewers: 321, thumbnail: '/images/logo-circle.png' },
  { id: 6, title: 'Community Call', viewers: 876, thumbnail: '/images/logo-circle.png' },
]

export function LivestreamsPage() {
  // Get all tokens for displaying with streams
  const { data: allTokens } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getAllTokens',
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-display font-bold">
            <span className="text-pump-green">📺</span> Livestreams
          </h1>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg bg-pump-green text-pump-dark font-medium text-sm">
              Featured
            </button>
            <button className="px-4 py-2 rounded-lg bg-pump-dark-lighter text-pump-white-muted font-medium text-sm hover:text-white transition-colors">
              Top Market Cap
            </button>
            <button className="px-4 py-2 rounded-lg bg-pump-dark-lighter text-pump-white-muted font-medium text-sm hover:text-white transition-colors">
              Most Viewers
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-pump-white-muted">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-pump-dark-border" />
            Include nsfw
          </label>
        </div>
      </div>

      {/* Stream Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mockStreams.map((stream, index) => {
          const tokenAddress = allTokens?.[index % (allTokens?.length || 1)]
          return (
            <Link
              key={stream.id}
              to={tokenAddress ? `/token/${tokenAddress}` : '#'}
              className="group"
            >
              <div className="bg-pump-dark-lighter rounded-xl overflow-hidden border border-pump-dark-border hover:border-pump-green transition-all">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-pump-dark">
                  <img
                    src={stream.thumbnail}
                    alt={stream.title}
                    className="w-full h-full object-cover opacity-60"
                  />
                  {/* Live Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold animate-pulse">
                      LIVE
                    </span>
                    <span className="px-2 py-1 rounded bg-pump-dark/80 text-white text-xs">
                      {stream.viewers.toLocaleString()} watching
                    </span>
                  </div>
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-pump-green/90 flex items-center justify-center">
                      <span className="text-3xl text-pump-dark ml-1">▶</span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-pump-dark flex-shrink-0 overflow-hidden">
                      <img
                        src={stream.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate group-hover:text-pump-green transition-colors">
                        {stream.title}
                      </h3>
                      <p className="text-pump-white-muted text-sm truncate">
                        Token Creator
                      </p>
                      <p className="text-pump-green text-xs font-mono mt-1">
                        MC: 1.2M PLS
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Coming Soon Notice */}
      {(!allTokens || allTokens.length === 0) && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-display font-bold mb-2">Livestreams Coming Soon</h2>
          <p className="text-pump-white-muted">
            Token creators will be able to stream live to their community
          </p>
        </div>
      )}
    </div>
  )
}
