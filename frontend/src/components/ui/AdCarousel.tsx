import { useState, useEffect, useCallback } from 'react'

// RL-009: Ad Carousel System
// Displays rotating advertisements with configurable timing

const AD_STORAGE_KEY = 'pump-phud-ad-config'

export interface AdSlot {
  id: string
  imageUrl: string
  linkUrl?: string
  title?: string
  active: boolean
  priority: number
  startTime?: number
  endTime?: number
  impressions: number
  clicks: number
}

interface AdCarouselProps {
  position?: 'top' | 'bottom' | 'sidebar'
  height?: number
  autoRotate?: boolean
  rotationInterval?: number
  className?: string
}

// Default ads (can be replaced via admin)
const DEFAULT_ADS: AdSlot[] = [
  {
    id: 'ad-1',
    imageUrl: '/ads/pump-phud-banner.png',
    linkUrl: 'https://pump.phud.io',
    title: 'PUMP.pHuD - Meme Launchpad',
    active: true,
    priority: 1,
    impressions: 0,
    clicks: 0,
  },
  {
    id: 'ad-2',
    imageUrl: '/ads/pulsechain-banner.png',
    linkUrl: 'https://pulsechain.com',
    title: 'PulseChain - The #1 EVM Chain',
    active: true,
    priority: 2,
    impressions: 0,
    clicks: 0,
  },
]

// Load ads from localStorage
function loadAds(): AdSlot[] {
  try {
    const stored = localStorage.getItem(AD_STORAGE_KEY)
    if (stored) {
      const ads = JSON.parse(stored) as AdSlot[]
      console.log('[RALPH RL-009] Ads loaded:', ads.length)
      return ads
    }
  } catch (error) {
    console.error('[RALPH RL-009] Failed to load ads:', error)
  }
  return DEFAULT_ADS
}

// Save ads to localStorage
function saveAds(ads: AdSlot[]) {
  try {
    localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(ads))
    console.log('[RALPH RL-009] Ads saved:', ads.length)
  } catch (error) {
    console.error('[RALPH RL-009] Failed to save ads:', error)
  }
}

export function AdCarousel({
  position = 'top',
  height = 80,
  autoRotate = true,
  rotationInterval = 8000,
}: AdCarouselProps) {
  const [ads, setAds] = useState<AdSlot[]>(() => loadAds())
  const [currentAdIndex, setCurrentAdIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Get active ads sorted by priority
  const activeAds = ads
    .filter(ad => {
      if (!ad.active) return false
      const now = Date.now()
      if (ad.startTime && now < ad.startTime) return false
      if (ad.endTime && now > ad.endTime) return false
      return true
    })
    .sort((a, b) => a.priority - b.priority)

  // Rotate ads
  useEffect(() => {
    if (!autoRotate || isHovered || activeAds.length <= 1) return

    const timer = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentAdIndex(prev => (prev + 1) % activeAds.length)
        setIsTransitioning(false)
      }, 300) // Transition duration
    }, rotationInterval)

    return () => clearInterval(timer)
  }, [autoRotate, isHovered, activeAds.length, rotationInterval])

  // Track impression
  useEffect(() => {
    if (activeAds.length === 0) return
    const currentAd = activeAds[currentAdIndex]
    if (!currentAd) return

    // Update impressions
    setAds(prevAds => {
      const updated = prevAds.map(ad =>
        ad.id === currentAd.id ? { ...ad, impressions: ad.impressions + 1 } : ad
      )
      saveAds(updated)
      return updated
    })

    // RALPH RL-009 VALIDATION
    console.log('[RALPH RL-009] Ad impression:', {
      adId: currentAd.id,
      title: currentAd.title,
      totalImpressions: currentAd.impressions + 1,
    })
  }, [currentAdIndex, activeAds])

  // Handle ad click
  const handleAdClick = useCallback((ad: AdSlot) => {
    // Update clicks
    setAds(prevAds => {
      const updated = prevAds.map(a =>
        a.id === ad.id ? { ...a, clicks: a.clicks + 1 } : a
      )
      saveAds(updated)
      return updated
    })

    // RALPH RL-009 VALIDATION
    console.log('[RALPH RL-009] Ad click:', {
      adId: ad.id,
      title: ad.title,
      linkUrl: ad.linkUrl,
      totalClicks: ad.clicks + 1,
    })

    // Open link
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')
    }
  }, [])

  // Navigation handlers
  const goToPrev = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentAdIndex(prev => (prev - 1 + activeAds.length) % activeAds.length)
      setIsTransitioning(false)
    }, 300)
  }, [activeAds.length])

  const goToNext = useCallback(() => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentAdIndex(prev => (prev + 1) % activeAds.length)
      setIsTransitioning(false)
    }, 300)
  }, [activeAds.length])

  // Don't render if no active ads
  if (activeAds.length === 0) {
    return null
  }

  const currentAd = activeAds[currentAdIndex]

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        backgroundColor: 'rgba(26,26,26,0.8)',
        borderRadius: position === 'sidebar' ? '8px' : '0',
        border: '1px solid rgba(0,255,0,0.1)',
        overflow: 'hidden',
        ...(position === 'top' && { borderTop: 'none', borderLeft: 'none', borderRight: 'none' }),
        ...(position === 'bottom' && { borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ad Content */}
      <div
        onClick={() => handleAdClick(currentAd)}
        style={{
          width: '100%',
          height: '100%',
          cursor: currentAd.linkUrl ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {currentAd.imageUrl ? (
          <img
            src={currentAd.imageUrl}
            alt={currentAd.title || 'Advertisement'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              // Fallback to text if image fails
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#00ff00',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            {currentAd.title || 'Advertisement'}
          </div>
        )}
      </div>

      {/* Navigation Arrows - Only show on hover with multiple ads */}
      {activeAds.length > 1 && isHovered && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goToPrev()
            }}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '28px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(0,255,0,0.3)',
              borderRadius: '50%',
              color: '#00ff00',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ◀
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '28px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(0,255,0,0.3)',
              borderRadius: '50%',
              color: '#00ff00',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ▶
          </button>
        </>
      )}

      {/* Progress Dots - Only show with multiple ads */}
      {activeAds.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
        }}>
          {activeAds.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentAdIndex(index)
              }}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: index === currentAdIndex ? '#00ff00' : 'rgba(255,255,255,0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </div>
      )}

      {/* Ad label */}
      <div style={{
        position: 'absolute',
        top: '4px',
        right: '8px',
        fontSize: '9px',
        color: '#666',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '2px 6px',
        borderRadius: '3px',
      }}>
        AD
      </div>

      {/* RL-009 Debug Badge (visible in dev) */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '8px',
          fontSize: '8px',
          color: '#00ff00',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '2px 4px',
          borderRadius: '3px',
        }}>
          RL-009
        </div>
      )}
    </div>
  )
}

// Export utility for managing ads (admin use)
export function useAdManager() {
  const [ads, setAds] = useState<AdSlot[]>(() => loadAds())

  const addAd = useCallback((ad: Omit<AdSlot, 'id' | 'impressions' | 'clicks'>) => {
    const newAd: AdSlot = {
      ...ad,
      id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      impressions: 0,
      clicks: 0,
    }
    setAds(prev => {
      const updated = [...prev, newAd]
      saveAds(updated)
      return updated
    })
    console.log('[RALPH RL-009] Ad added:', newAd.id)
    return newAd.id
  }, [])

  const removeAd = useCallback((adId: string) => {
    setAds(prev => {
      const updated = prev.filter(ad => ad.id !== adId)
      saveAds(updated)
      return updated
    })
    console.log('[RALPH RL-009] Ad removed:', adId)
  }, [])

  const updateAd = useCallback((adId: string, updates: Partial<AdSlot>) => {
    setAds(prev => {
      const updated = prev.map(ad => ad.id === adId ? { ...ad, ...updates } : ad)
      saveAds(updated)
      return updated
    })
    console.log('[RALPH RL-009] Ad updated:', adId, updates)
  }, [])

  const getAdStats = useCallback(() => {
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0)
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0)
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0.00'

    return {
      totalAds: ads.length,
      activeAds: ads.filter(ad => ad.active).length,
      totalImpressions,
      totalClicks,
      ctr: `${ctr}%`,
    }
  }, [ads])

  return {
    ads,
    addAd,
    removeAd,
    updateAd,
    getAdStats,
  }
}
