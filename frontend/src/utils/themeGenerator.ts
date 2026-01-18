/**
 * Dynamic Theme Generator
 * Generates custom dashboard themes based on token metadata
 * Each token gets a unique visual identity derived from its narrative
 */

export interface TokenTheme {
  // Core colors
  primary: string
  secondary: string
  accent: string
  glow: string

  // Gradients
  backgroundGradient: string
  cardGradient: string
  buttonGradient: string

  // Effects
  shadowColor: string
  borderGlow: string

  // Narrative elements
  emoji: string
  ambiance: 'fire' | 'ice' | 'blood' | 'void' | 'ethereal' | 'toxic' | 'gold' | 'shadow' | 'cosmic' | 'nature'
  animations: string[]

  // Typography
  titleFont: string
  accentFont: string

  // Atmosphere
  particleType: 'embers' | 'snow' | 'blood' | 'void' | 'spirits' | 'poison' | 'gold' | 'smoke' | 'stars' | 'leaves'
  fogColor: string
  fogOpacity: number
}

// Keyword to theme mapping
const THEME_KEYWORDS: Record<string, Partial<TokenTheme>> = {
  // Fire/Hell themes
  fire: {
    primary: '#FF4500',
    secondary: '#FF6B35',
    accent: '#FFA500',
    glow: 'rgba(255,69,0,0.6)',
    ambiance: 'fire',
    emoji: '🔥',
    particleType: 'embers',
    fogColor: 'rgba(255,69,0,0.05)',
  },
  hell: {
    primary: '#8B0000',
    secondary: '#DC143C',
    accent: '#FF4500',
    glow: 'rgba(139,0,0,0.6)',
    ambiance: 'fire',
    emoji: '😈',
    particleType: 'embers',
    fogColor: 'rgba(139,0,0,0.08)',
  },
  demon: {
    primary: '#8B0000',
    secondary: '#4B0082',
    accent: '#DC143C',
    glow: 'rgba(139,0,0,0.5)',
    ambiance: 'fire',
    emoji: '😈',
    particleType: 'embers',
    fogColor: 'rgba(75,0,130,0.05)',
  },

  // Blood/Vampire themes
  blood: {
    primary: '#8B0000',
    secondary: '#DC143C',
    accent: '#FF1744',
    glow: 'rgba(220,20,60,0.6)',
    ambiance: 'blood',
    emoji: '🩸',
    particleType: 'blood',
    fogColor: 'rgba(139,0,0,0.08)',
  },
  vampire: {
    primary: '#4A0000',
    secondary: '#8B0000',
    accent: '#DC143C',
    glow: 'rgba(74,0,0,0.7)',
    ambiance: 'blood',
    emoji: '🧛',
    particleType: 'blood',
    fogColor: 'rgba(74,0,0,0.1)',
  },

  // Ice/Frost themes
  ice: {
    primary: '#00CED1',
    secondary: '#87CEEB',
    accent: '#E0FFFF',
    glow: 'rgba(0,206,209,0.5)',
    ambiance: 'ice',
    emoji: '❄️',
    particleType: 'snow',
    fogColor: 'rgba(135,206,235,0.05)',
  },
  frost: {
    primary: '#4169E1',
    secondary: '#87CEEB',
    accent: '#B0E0E6',
    glow: 'rgba(65,105,225,0.5)',
    ambiance: 'ice',
    emoji: '🥶',
    particleType: 'snow',
    fogColor: 'rgba(65,105,225,0.05)',
  },
  frozen: {
    primary: '#1E90FF',
    secondary: '#00BFFF',
    accent: '#E0FFFF',
    glow: 'rgba(30,144,255,0.5)',
    ambiance: 'ice',
    emoji: '🧊',
    particleType: 'snow',
    fogColor: 'rgba(30,144,255,0.05)',
  },

  // Void/Dark themes
  void: {
    primary: '#1a0a2e',
    secondary: '#2d1b4e',
    accent: '#8B5CF6',
    glow: 'rgba(139,92,246,0.4)',
    ambiance: 'void',
    emoji: '🕳️',
    particleType: 'void',
    fogColor: 'rgba(26,10,46,0.1)',
  },
  dark: {
    primary: '#0a0a0a',
    secondary: '#1a1a1f',
    accent: '#666',
    glow: 'rgba(100,100,100,0.3)',
    ambiance: 'shadow',
    emoji: '🌑',
    particleType: 'smoke',
    fogColor: 'rgba(0,0,0,0.1)',
  },
  shadow: {
    primary: '#1a1a2e',
    secondary: '#2a2a3e',
    accent: '#4a4a5e',
    glow: 'rgba(42,42,62,0.5)',
    ambiance: 'shadow',
    emoji: '👤',
    particleType: 'smoke',
    fogColor: 'rgba(26,26,46,0.1)',
  },

  // Ghost/Spirit themes
  ghost: {
    primary: '#E8E8FF',
    secondary: '#C8C8FF',
    accent: '#9898FF',
    glow: 'rgba(200,200,255,0.4)',
    ambiance: 'ethereal',
    emoji: '👻',
    particleType: 'spirits',
    fogColor: 'rgba(200,200,255,0.08)',
  },
  spirit: {
    primary: '#B8B8FF',
    secondary: '#9898E8',
    accent: '#7878C8',
    glow: 'rgba(184,184,255,0.4)',
    ambiance: 'ethereal',
    emoji: '👻',
    particleType: 'spirits',
    fogColor: 'rgba(184,184,255,0.06)',
  },
  soul: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    accent: '#C4B5FD',
    glow: 'rgba(139,92,246,0.5)',
    ambiance: 'ethereal',
    emoji: '💀',
    particleType: 'spirits',
    fogColor: 'rgba(139,92,246,0.05)',
  },
  phantom: {
    primary: '#4a4a6a',
    secondary: '#6a6a8a',
    accent: '#8a8aaa',
    glow: 'rgba(106,106,138,0.4)',
    ambiance: 'ethereal',
    emoji: '⛓️',
    particleType: 'spirits',
    fogColor: 'rgba(74,74,106,0.08)',
  },

  // Toxic/Poison themes
  toxic: {
    primary: '#39FF14',
    secondary: '#7FFF00',
    accent: '#ADFF2F',
    glow: 'rgba(57,255,20,0.5)',
    ambiance: 'toxic',
    emoji: '☣️',
    particleType: 'poison',
    fogColor: 'rgba(57,255,20,0.05)',
  },
  poison: {
    primary: '#9400D3',
    secondary: '#8B008B',
    accent: '#32CD32',
    glow: 'rgba(148,0,211,0.5)',
    ambiance: 'toxic',
    emoji: '🧪',
    particleType: 'poison',
    fogColor: 'rgba(148,0,211,0.05)',
  },

  // Gold/Treasure themes
  gold: {
    primary: '#FFD700',
    secondary: '#FFA500',
    accent: '#B8860B',
    glow: 'rgba(255,215,0,0.5)',
    ambiance: 'gold',
    emoji: '👑',
    particleType: 'gold',
    fogColor: 'rgba(255,215,0,0.03)',
  },
  treasure: {
    primary: '#DAA520',
    secondary: '#CD853F',
    accent: '#8B4513',
    glow: 'rgba(218,165,32,0.5)',
    ambiance: 'gold',
    emoji: '💎',
    particleType: 'gold',
    fogColor: 'rgba(218,165,32,0.03)',
  },

  // Cosmic/Space themes
  moon: {
    primary: '#C0C0C0',
    secondary: '#808080',
    accent: '#4169E1',
    glow: 'rgba(192,192,192,0.4)',
    ambiance: 'cosmic',
    emoji: '🌙',
    particleType: 'stars',
    fogColor: 'rgba(192,192,192,0.05)',
  },
  cosmic: {
    primary: '#4B0082',
    secondary: '#8A2BE2',
    accent: '#9400D3',
    glow: 'rgba(75,0,130,0.5)',
    ambiance: 'cosmic',
    emoji: '🌌',
    particleType: 'stars',
    fogColor: 'rgba(75,0,130,0.05)',
  },
  star: {
    primary: '#FFD700',
    secondary: '#FFA500',
    accent: '#FFFFFF',
    glow: 'rgba(255,215,0,0.5)',
    ambiance: 'cosmic',
    emoji: '⭐',
    particleType: 'stars',
    fogColor: 'rgba(255,215,0,0.03)',
  },

  // Nature themes
  nature: {
    primary: '#228B22',
    secondary: '#32CD32',
    accent: '#90EE90',
    glow: 'rgba(34,139,34,0.4)',
    ambiance: 'nature',
    emoji: '🌿',
    particleType: 'leaves',
    fogColor: 'rgba(34,139,34,0.05)',
  },

  // Creature themes
  reaper: {
    primary: '#0a0a0a',
    secondary: '#1a1a1f',
    accent: '#DC143C',
    glow: 'rgba(220,20,60,0.3)',
    ambiance: 'shadow',
    emoji: '💀',
    particleType: 'smoke',
    fogColor: 'rgba(0,0,0,0.1)',
  },
  skull: {
    primary: '#1a1a1f',
    secondary: '#2a2a30',
    accent: '#e8e8e8',
    glow: 'rgba(232,232,232,0.2)',
    ambiance: 'shadow',
    emoji: '💀',
    particleType: 'smoke',
    fogColor: 'rgba(26,26,31,0.08)',
  },
  bat: {
    primary: '#1a0a2e',
    secondary: '#2d1b4e',
    accent: '#8B5CF6',
    glow: 'rgba(139,92,246,0.4)',
    ambiance: 'shadow',
    emoji: '🦇',
    particleType: 'smoke',
    fogColor: 'rgba(26,10,46,0.08)',
  },
  wolf: {
    primary: '#2F4F4F',
    secondary: '#4a6a6a',
    accent: '#C0C0C0',
    glow: 'rgba(47,79,79,0.5)',
    ambiance: 'shadow',
    emoji: '🐺',
    particleType: 'smoke',
    fogColor: 'rgba(47,79,79,0.08)',
  },
  dragon: {
    primary: '#8B0000',
    secondary: '#FF4500',
    accent: '#FFD700',
    glow: 'rgba(139,0,0,0.6)',
    ambiance: 'fire',
    emoji: '🐉',
    particleType: 'embers',
    fogColor: 'rgba(255,69,0,0.05)',
  },

  // Meme themes
  doge: {
    primary: '#C4A24D',
    secondary: '#DFC27D',
    accent: '#FFD700',
    glow: 'rgba(196,162,77,0.5)',
    ambiance: 'gold',
    emoji: '🐕',
    particleType: 'gold',
    fogColor: 'rgba(196,162,77,0.03)',
  },
  pepe: {
    primary: '#228B22',
    secondary: '#32CD32',
    accent: '#90EE90',
    glow: 'rgba(34,139,34,0.4)',
    ambiance: 'toxic',
    emoji: '🐸',
    particleType: 'poison',
    fogColor: 'rgba(34,139,34,0.05)',
  },
  cat: {
    primary: '#FF69B4',
    secondary: '#FF1493',
    accent: '#FFB6C1',
    glow: 'rgba(255,105,180,0.4)',
    ambiance: 'ethereal',
    emoji: '🐱',
    particleType: 'spirits',
    fogColor: 'rgba(255,105,180,0.03)',
  },
}

// Animation sets by ambiance
const ANIMATIONS_BY_AMBIANCE: Record<TokenTheme['ambiance'], string[]> = {
  fire: ['emberFloat', 'flameFlicker', 'heatWave'],
  ice: ['snowFall', 'crystalShimmer', 'frostSpread'],
  blood: ['bloodDrip', 'pulseGlow', 'heartbeat'],
  void: ['voidPulse', 'darkRipple', 'abyssGaze'],
  ethereal: ['ghostFloat', 'spiritFade', 'etherealGlow'],
  toxic: ['bubblePop', 'toxicPulse', 'acidDrip'],
  gold: ['sparkle', 'goldShimmer', 'treasureGlow'],
  shadow: ['smokeRise', 'shadowCreep', 'darkPulse'],
  cosmic: ['starTwinkle', 'nebulaPulse', 'cosmicSwirl'],
  nature: ['leafFall', 'vineGrow', 'naturePulse'],
}

/**
 * Analyze token metadata and generate a custom theme
 */
export function generateTokenTheme(
  name: string,
  symbol: string,
  description: string,
  _imageUrl?: string // Reserved for future color extraction from images
): TokenTheme {
  // Combine all text for keyword analysis
  const allText = `${name} ${symbol} ${description}`.toLowerCase()

  // Find matching keywords
  let matchedTheme: Partial<TokenTheme> = {}
  let matchStrength = 0

  for (const [keyword, theme] of Object.entries(THEME_KEYWORDS)) {
    const regex = new RegExp(keyword, 'gi')
    const matches = allText.match(regex)
    if (matches && matches.length > matchStrength) {
      matchStrength = matches.length
      matchedTheme = theme
    }
  }

  // Default theme if no keywords matched
  const defaultTheme: TokenTheme = {
    primary: '#22c55e',
    secondary: '#8B5CF6',
    accent: '#e8e8e8',
    glow: 'rgba(34,197,94,0.5)',
    backgroundGradient: 'linear-gradient(180deg, #0a0a0c 0%, #111114 100%)',
    cardGradient: 'linear-gradient(145deg, rgba(17,17,20,0.95) 0%, rgba(10,10,12,0.98) 100%)',
    buttonGradient: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
    shadowColor: 'rgba(34,197,94,0.3)',
    borderGlow: 'rgba(139,92,246,0.2)',
    emoji: '✨',
    ambiance: 'ethereal',
    animations: ['candleFlicker', 'ghostFloat', 'spiritFloat'],
    titleFont: 'Cinzel, serif',
    accentFont: 'monospace',
    particleType: 'spirits',
    fogColor: 'rgba(139,92,246,0.05)',
    fogOpacity: 0.3,
  }

  // Merge matched theme with defaults
  const ambiance = matchedTheme.ambiance || defaultTheme.ambiance
  const primary = matchedTheme.primary || defaultTheme.primary
  const secondary = matchedTheme.secondary || defaultTheme.secondary

  const theme: TokenTheme = {
    ...defaultTheme,
    ...matchedTheme,
    // Generate gradients from colors
    backgroundGradient: `linear-gradient(180deg, #0a0a0c 0%, ${hexToRgba(primary, 0.05)} 50%, #0a0a0c 100%)`,
    cardGradient: `linear-gradient(145deg, ${hexToRgba(primary, 0.08)} 0%, rgba(10,10,12,0.98) 100%)`,
    buttonGradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    shadowColor: hexToRgba(primary, 0.3),
    borderGlow: hexToRgba(secondary, 0.3),
    animations: ANIMATIONS_BY_AMBIANCE[ambiance],
    fogOpacity: 0.3,
  }

  return theme
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  // Handle rgba strings
  if (hex.startsWith('rgba')) return hex
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
  }

  // Handle hex
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Generate CSS for particle effects based on theme
 */
export function generateParticleCSS(theme: TokenTheme): string {
  switch (theme.particleType) {
    case 'embers':
      return `
        @keyframes emberFloat {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-10vh) scale(1); opacity: 0; }
        }
      `
    case 'snow':
      return `
        @keyframes snowFall {
          0% { transform: translateY(-10vh) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(100vh) translateX(20px); opacity: 0; }
        }
      `
    case 'blood':
      return `
        @keyframes bloodDrip {
          0% { transform: translateY(-100%) scaleY(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(0) scaleY(1); }
          90% { opacity: 1; }
          100% { transform: translateY(100px) scaleY(0.5); opacity: 0; }
        }
      `
    case 'spirits':
      return `
        @keyframes spiritFloat {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px) scale(1.1); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-10px) scale(0.9); opacity: 0.4; }
          75% { transform: translateY(-30px) translateX(5px) scale(1.05); opacity: 0.5; }
        }
      `
    case 'poison':
      return `
        @keyframes poisonBubble {
          0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
        }
      `
    case 'gold':
      return `
        @keyframes goldSparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1); }
        }
      `
    case 'stars':
      return `
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `
    case 'smoke':
      return `
        @keyframes smokeRise {
          0% { transform: translateY(0) scale(1); opacity: 0.3; }
          100% { transform: translateY(-100px) scale(2); opacity: 0; }
        }
      `
    case 'leaves':
      return `
        @keyframes leafFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          50% { opacity: 0.7; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `
    default:
      return ''
  }
}

/**
 * Get narrative section titles based on theme
 */
export function getNarrativeTitles(theme: TokenTheme): {
  stats: string
  chart: string
  trade: string
  holders: string
  transactions: string
} {
  switch (theme.ambiance) {
    case 'fire':
      return {
        stats: 'Inferno Metrics',
        chart: 'Flames of Fortune',
        trade: 'Fuel the Fire',
        holders: 'Disciples of Flame',
        transactions: 'Burnt Offerings',
      }
    case 'ice':
      return {
        stats: 'Frozen Assets',
        chart: 'Crystal Formations',
        trade: 'Freeze or Thaw',
        holders: 'Ice Keepers',
        transactions: 'Frost Trails',
      }
    case 'blood':
      return {
        stats: 'Vital Signs',
        chart: 'Blood Flow',
        trade: 'Make a Sacrifice',
        holders: 'Blood Bound',
        transactions: 'The Bloodline',
      }
    case 'void':
      return {
        stats: 'Void Readings',
        chart: 'Abyss Depths',
        trade: 'Embrace the Void',
        holders: 'Void Walkers',
        transactions: 'Echoes in Darkness',
      }
    case 'ethereal':
      return {
        stats: 'Spirit Essence',
        chart: 'Ethereal Waves',
        trade: 'Channel Spirits',
        holders: 'Soul Keepers',
        transactions: 'Spirit Crossings',
      }
    case 'toxic':
      return {
        stats: 'Toxicity Levels',
        chart: 'Contamination Spread',
        trade: 'Inject the Poison',
        holders: 'The Infected',
        transactions: 'Toxic Trails',
      }
    case 'gold':
      return {
        stats: 'Treasury Status',
        chart: 'Golden Path',
        trade: 'Claim Your Fortune',
        holders: 'Treasure Keepers',
        transactions: 'Golden Ledger',
      }
    case 'shadow':
      return {
        stats: 'Shadow Stats',
        chart: 'Dark Patterns',
        trade: 'Deal in Shadows',
        holders: 'Shadow Council',
        transactions: 'Hidden Movements',
      }
    case 'cosmic':
      return {
        stats: 'Cosmic Data',
        chart: 'Stellar Trajectory',
        trade: 'Navigate the Stars',
        holders: 'Star Gazers',
        transactions: 'Cosmic Events',
      }
    case 'nature':
      return {
        stats: 'Growth Metrics',
        chart: 'Natural Cycles',
        trade: 'Cultivate Growth',
        holders: 'Gardeners',
        transactions: 'Seed Records',
      }
    default:
      return {
        stats: 'Dark Metrics',
        chart: 'Price Prophecy',
        trade: 'Make Your Offering',
        holders: 'The Congregation',
        transactions: 'The Ledger',
      }
  }
}
