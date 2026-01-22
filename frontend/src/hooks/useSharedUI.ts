import { useState, useCallback } from 'react'
import type { BoxLayout } from './useLayoutPersistence'
import type { BoxFrameAssignment } from './useCustomFrames'

const SHARED_UI_STORAGE_KEY = 'pump-phud-shared-uis'

export interface SharedUIConfig {
  id: string
  name: string
  createdBy: string // wallet address
  createdAt: number
  layouts: Record<string, BoxLayout>
  frameAssignments: BoxFrameAssignment
  description?: string
  previewUrl?: string
}

export interface UseSharedUIReturn {
  sharedConfigs: SharedUIConfig[]
  publishUI: (config: Omit<SharedUIConfig, 'id' | 'createdAt'>) => string
  importUI: (configId: string) => SharedUIConfig | null
  importUIFromCode: (code: string) => SharedUIConfig | null
  deleteSharedUI: (configId: string) => void
  generateShareCode: (config: SharedUIConfig) => string
  isLoaded: boolean
}

// Generate a shareable code from config
function encodeConfig(config: SharedUIConfig): string {
  const json = JSON.stringify(config)
  // Base64 encode for sharing
  return btoa(encodeURIComponent(json))
}

// Decode a share code back to config
function decodeConfig(code: string): SharedUIConfig | null {
  try {
    const json = decodeURIComponent(atob(code))
    const config = JSON.parse(json) as SharedUIConfig
    // RALPH RL-006 VALIDATION
    console.log('[RALPH RL-006] Share code decoded:', {
      configId: config.id,
      configName: config.name,
      boxCount: Object.keys(config.layouts).length,
    })
    return config
  } catch (error) {
    console.error('[RALPH RL-006] Failed to decode share code:', error)
    return null
  }
}

export function useSharedUI(): UseSharedUIReturn {
  const [sharedConfigs, setSharedConfigs] = useState<SharedUIConfig[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load saved shared configs on mount
  useState(() => {
    try {
      const stored = localStorage.getItem(SHARED_UI_STORAGE_KEY)
      if (stored) {
        const configs = JSON.parse(stored) as SharedUIConfig[]
        setSharedConfigs(configs)
        // RALPH RL-006 VALIDATION
        console.log('[RALPH RL-006] Shared UIs loaded:', {
          count: configs.length,
          names: configs.map(c => c.name),
        })
      }
    } catch (error) {
      console.error('[RALPH RL-006] Failed to load shared UIs:', error)
    }
    setIsLoaded(true)
  })

  // Save configs to localStorage
  const saveConfigs = useCallback((configs: SharedUIConfig[]) => {
    try {
      localStorage.setItem(SHARED_UI_STORAGE_KEY, JSON.stringify(configs))
    } catch (error) {
      console.error('[RALPH RL-006] Failed to save shared UIs:', error)
    }
  }, [])

  // Publish a new UI configuration
  const publishUI = useCallback((config: Omit<SharedUIConfig, 'id' | 'createdAt'>): string => {
    const id = `shared-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const fullConfig: SharedUIConfig = {
      ...config,
      id,
      createdAt: Date.now(),
    }

    setSharedConfigs(prev => {
      const updated = [...prev, fullConfig]
      saveConfigs(updated)
      return updated
    })

    // RALPH RL-006 VALIDATION
    console.log('[RALPH RL-006] UI published:', {
      id,
      name: config.name,
      createdBy: config.createdBy,
      layouts: Object.keys(config.layouts).length,
      frameAssignments: Object.keys(config.frameAssignments).length,
    })

    return id
  }, [saveConfigs])

  // Import a UI from saved configs
  const importUI = useCallback((configId: string): SharedUIConfig | null => {
    const config = sharedConfigs.find(c => c.id === configId)
    if (config) {
      // RALPH RL-006 VALIDATION
      console.log('[RALPH RL-006] UI imported from saved:', {
        id: config.id,
        name: config.name,
      })
    }
    return config || null
  }, [sharedConfigs])

  // Import UI from a share code
  const importUIFromCode = useCallback((code: string): SharedUIConfig | null => {
    const config = decodeConfig(code)
    if (config) {
      // Add to saved configs if not already present
      setSharedConfigs(prev => {
        const exists = prev.some(c => c.id === config.id)
        if (!exists) {
          const updated = [...prev, config]
          saveConfigs(updated)
          return updated
        }
        return prev
      })

      // RALPH RL-006 VALIDATION
      console.log('[RALPH RL-006] UI imported from code:', {
        id: config.id,
        name: config.name,
      })
    }
    return config
  }, [saveConfigs])

  // Delete a shared UI
  const deleteSharedUI = useCallback((configId: string) => {
    setSharedConfigs(prev => {
      const updated = prev.filter(c => c.id !== configId)
      saveConfigs(updated)

      // RALPH RL-006 VALIDATION
      console.log('[RALPH RL-006] Shared UI deleted:', configId)

      return updated
    })
  }, [saveConfigs])

  // Generate shareable code
  const generateShareCode = useCallback((config: SharedUIConfig): string => {
    const code = encodeConfig(config)

    // RALPH RL-006 VALIDATION
    console.log('[RALPH RL-006] Share code generated:', {
      configId: config.id,
      codeLength: code.length,
    })

    return code
  }, [])

  return {
    sharedConfigs,
    publishUI,
    importUI,
    importUIFromCode,
    deleteSharedUI,
    generateShareCode,
    isLoaded,
  }
}
