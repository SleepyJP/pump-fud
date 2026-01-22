import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'pump-phud-custom-frames'

export interface FrameConfig {
  id: string
  name: string
  imageUrl: string
  borderWidth: number
  borderRadius: number
  glowColor?: string
  glowIntensity?: number
}

export interface BoxFrameAssignment {
  [boxId: string]: string | null // frameId or null for default
}

export interface UseCustomFramesReturn {
  frames: FrameConfig[]
  boxFrames: BoxFrameAssignment
  addFrame: (frame: Omit<FrameConfig, 'id'>) => string
  removeFrame: (frameId: string) => void
  updateFrame: (frameId: string, updates: Partial<FrameConfig>) => void
  assignFrameToBox: (boxId: string, frameId: string | null) => void
  getBoxFrame: (boxId: string) => FrameConfig | null
  isLoaded: boolean
}

// Default premium frames
const DEFAULT_FRAMES: FrameConfig[] = [
  {
    id: 'gothic-gold',
    name: 'Gothic Gold',
    imageUrl: '/frames/gothic-gold.png',
    borderWidth: 12,
    borderRadius: 8,
    glowColor: '#ffd700',
    glowIntensity: 0.4,
  },
  {
    id: 'neon-green',
    name: 'Neon Matrix',
    imageUrl: '/frames/neon-green.png',
    borderWidth: 8,
    borderRadius: 12,
    glowColor: '#00ff00',
    glowIntensity: 0.6,
  },
  {
    id: 'cyber-purple',
    name: 'Cyber Purple',
    imageUrl: '/frames/cyber-purple.png',
    borderWidth: 10,
    borderRadius: 16,
    glowColor: '#a855f7',
    glowIntensity: 0.5,
  },
  {
    id: 'fire-red',
    name: 'Inferno',
    imageUrl: '/frames/fire-red.png',
    borderWidth: 14,
    borderRadius: 4,
    glowColor: '#ef4444',
    glowIntensity: 0.5,
  },
]

interface StoredState {
  customFrames: FrameConfig[]
  boxFrames: BoxFrameAssignment
}

export function useCustomFrames(): UseCustomFramesReturn {
  const [frames, setFrames] = useState<FrameConfig[]>(DEFAULT_FRAMES)
  const [boxFrames, setBoxFrames] = useState<BoxFrameAssignment>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as StoredState
        // Merge default frames with custom frames
        const customFrames = parsed.customFrames || []
        setFrames([...DEFAULT_FRAMES, ...customFrames])
        setBoxFrames(parsed.boxFrames || {})

        // RALPH RL-005 VALIDATION
        console.log('[RALPH RL-005] Custom frames loaded:', {
          defaultFrames: DEFAULT_FRAMES.length,
          customFrames: customFrames.length,
          boxAssignments: Object.keys(parsed.boxFrames || {}).length,
        })
      } else {
        console.log('[RALPH RL-005] No custom frames found, using defaults')
      }
    } catch (error) {
      console.error('[RALPH RL-005] Failed to load custom frames:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage
  const saveState = useCallback((newFrames: FrameConfig[], newBoxFrames: BoxFrameAssignment) => {
    try {
      // Only save custom frames (not default ones)
      const customFrames = newFrames.filter(f => !DEFAULT_FRAMES.some(df => df.id === f.id))
      const state: StoredState = { customFrames, boxFrames: newBoxFrames }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

      // RALPH RL-005 VALIDATION
      console.log('[RALPH RL-005] Frames saved to localStorage:', {
        customFrames: customFrames.length,
        boxAssignments: Object.keys(newBoxFrames).length,
      })
    } catch (error) {
      console.error('[RALPH RL-005] Failed to save custom frames:', error)
    }
  }, [])

  // Add a new custom frame
  const addFrame = useCallback((frame: Omit<FrameConfig, 'id'>): string => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newFrame: FrameConfig = { ...frame, id }

    setFrames(prev => {
      const updated = [...prev, newFrame]
      saveState(updated, boxFrames)
      return updated
    })

    // RALPH RL-005 VALIDATION
    console.log('[RALPH RL-005] Custom frame added:', {
      id,
      name: frame.name,
      imageUrl: frame.imageUrl,
    })

    return id
  }, [boxFrames, saveState])

  // Remove a custom frame
  const removeFrame = useCallback((frameId: string) => {
    // Can't remove default frames
    if (DEFAULT_FRAMES.some(f => f.id === frameId)) {
      console.warn('[RALPH RL-005] Cannot remove default frame:', frameId)
      return
    }

    setFrames(prev => {
      const updated = prev.filter(f => f.id !== frameId)

      // Also remove any box assignments using this frame
      const newBoxFrames = { ...boxFrames }
      Object.keys(newBoxFrames).forEach(boxId => {
        if (newBoxFrames[boxId] === frameId) {
          newBoxFrames[boxId] = null
        }
      })
      setBoxFrames(newBoxFrames)
      saveState(updated, newBoxFrames)

      return updated
    })

    // RALPH RL-005 VALIDATION
    console.log('[RALPH RL-005] Custom frame removed:', frameId)
  }, [boxFrames, saveState])

  // Update a frame's properties
  const updateFrame = useCallback((frameId: string, updates: Partial<FrameConfig>) => {
    setFrames(prev => {
      const updated = prev.map(f => f.id === frameId ? { ...f, ...updates } : f)
      saveState(updated, boxFrames)
      return updated
    })

    // RALPH RL-005 VALIDATION
    console.log('[RALPH RL-005] Frame updated:', { frameId, updates })
  }, [boxFrames, saveState])

  // Assign a frame to a box
  const assignFrameToBox = useCallback((boxId: string, frameId: string | null) => {
    setBoxFrames(prev => {
      const updated = { ...prev, [boxId]: frameId }
      saveState(frames, updated)

      // RALPH RL-005 VALIDATION
      console.log('[RALPH RL-005] Frame assigned to box:', {
        boxId,
        frameId,
        frameName: frameId ? frames.find(f => f.id === frameId)?.name : 'None',
      })

      return updated
    })
  }, [frames, saveState])

  // Get the frame assigned to a box
  const getBoxFrame = useCallback((boxId: string): FrameConfig | null => {
    const frameId = boxFrames[boxId]
    if (!frameId) return null
    return frames.find(f => f.id === frameId) || null
  }, [boxFrames, frames])

  return {
    frames,
    boxFrames,
    addFrame,
    removeFrame,
    updateFrame,
    assignFrameToBox,
    getBoxFrame,
    isLoaded,
  }
}
