import { useMemo } from 'react'

interface LivestreamEmbedProps {
  url: string | undefined
  tokenSymbol: string
  themeColor: string
}

export function LivestreamEmbed({ url, tokenSymbol, themeColor }: LivestreamEmbedProps) {
  // Parse URL to determine platform and get embed URL
  const embedData = useMemo(() => {
    if (!url) return null

    // YouTube Live
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (youtubeMatch) {
      return {
        platform: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`,
        chatUrl: `https://www.youtube.com/live_chat?v=${youtubeMatch[1]}&embed_domain=${window.location.hostname}`,
      }
    }

    // Twitch
    const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
    if (twitchMatch) {
      return {
        platform: 'twitch',
        embedUrl: `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${window.location.hostname}`,
        chatUrl: `https://www.twitch.tv/embed/${twitchMatch[1]}/chat?parent=${window.location.hostname}`,
      }
    }

    // Kick
    const kickMatch = url.match(/kick\.com\/([a-zA-Z0-9_]+)/)
    if (kickMatch) {
      return {
        platform: 'kick',
        embedUrl: `https://player.kick.com/${kickMatch[1]}`,
        chatUrl: null, // Kick doesn't support chat embeds
      }
    }

    return null
  }, [url])

  if (!url || !embedData) {
    return (
      <div style={{
        background: 'rgba(10,10,12,0.9)',
        border: `1px solid ${themeColor}20`,
        borderRadius: '16px',
        padding: '24px',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '20px' }}>📺</span>
          <h2 style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: themeColor,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Livestream
          </h2>
        </div>
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          border: `1px dashed ${themeColor}30`,
        }}>
          <span style={{ fontSize: '40px', opacity: 0.4 }}>📺</span>
          <p style={{ color: '#666', fontSize: '13px', marginTop: '12px' }}>
            No livestream configured for ${tokenSymbol}
          </p>
          <p style={{ color: '#444', fontSize: '11px', marginTop: '4px' }}>
            Token creators can add YouTube, Twitch, or Kick streams
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(10,10,12,0.9)',
      border: `1px solid ${themeColor}20`,
      borderRadius: '16px',
      padding: '24px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>
            {embedData.platform === 'youtube' ? '▶️' : embedData.platform === 'twitch' ? '💜' : '🟢'}
          </span>
          <h2 style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: themeColor,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {embedData.platform === 'youtube' ? 'YouTube Live' : embedData.platform === 'twitch' ? 'Twitch' : 'Kick'}
          </h2>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          backgroundColor: 'rgba(220,20,60,0.2)',
          borderRadius: '20px',
          border: '1px solid rgba(220,20,60,0.4)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#dc143c',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ color: '#dc143c', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Video Player */}
      <div style={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        overflow: 'hidden',
        borderRadius: '12px',
        border: `1px solid ${themeColor}30`,
        backgroundColor: '#000',
      }}>
        <iframe
          src={embedData.embedUrl}
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

      {/* Stream stats bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '12px',
        padding: '10px 16px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        fontSize: '11px',
      }}>
        <span style={{ color: '#666' }}>
          🎬 {embedData.platform.charAt(0).toUpperCase() + embedData.platform.slice(1)} Stream
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: themeColor,
            textDecoration: 'none',
          }}
        >
          Open in new tab ↗
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
