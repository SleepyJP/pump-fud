import { useState, useCallback, useEffect } from 'react'
import type { Position } from './useDraggable'
import type { Size } from './useResizable'

const STORAGE_KEY = 'pump-phud-ui-layout'

export interface BoxLayout {
  position: Position
  size: Size
  zIndex: number
}

export interface LayoutState {
  [boxId: string]: BoxLayout
}

export interface UseLayoutPersistenceReturn {
  savedLayout: LayoutState
  saveLayout: (layout: LayoutState) => void
  saveBoxLayout: (boxId: string, layout: BoxLayout) => void
  resetLayout: () => void
  isLoaded: boolean
}

const DEFAULT_LAYOUTS: LayoutState = {
  'chart-box': {
    position: { x: 20, y: 80 },
    size: { width: 620, height: 400 },
    zIndex: 10,
  },
  'swapper-box': {
    position: { x: 660, y: 80 },
    size: { width: 300, height: 450 },
    zIndex: 10,
  },
  'transaction-feed-box': {
    position: { x: 20, y: 500 },
    size: { width: 450, height: 280 },
    zIndex: 10,
  },
  'message-board-box': {
    position: { x: 490, y: 500 },
    size: { width: 470, height: 280 },
    zIndex: 10,
  },
}

export function useLayoutPersistence(): UseLayoutPersistenceReturn {
  const [savedLayout, setSavedLayout] = useState<LayoutState>(DEFAULT_LAYOUTS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as LayoutState
        setSavedLayout({ ...DEFAULT_LAYOUTS, ...parsed })

        // RALPH LOOP 3 VALIDATION: Confirm load
        console.log('[RALPH RL-003] Layout loaded from localStorage:', {
          key: STORAGE_KEY,
          boxCount: Object.keys(parsed).length,
          boxes: Object.keys(parsed),
        })
      } else {
        console.log('[RALPH RL-003] No saved layout found, using defaults')
      }
    } catch (error) {
      console.error('[RALPH RL-003] Failed to load layout:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save entire layout
  const saveLayout = useCallback((layout: LayoutState) => {
    setSavedLayout(layout)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))

      // RALPH LOOP 3 VALIDATION: Confirm save
      console.log('[RALPH RL-003] Layout saved to localStorage:', {
        key: STORAGE_KEY,
        boxCount: Object.keys(layout).length,
      })
    } catch (error) {
      console.error('[RALPH RL-003] Failed to save layout:', error)
    }
  }, [])

  // Save single box layout
  const saveBoxLayout = useCallback((boxId: string, layout: BoxLayout) => {
    setSavedLayout(prev => {
      const newLayout = { ...prev, [boxId]: layout }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))

        // RALPH LOOP 3 VALIDATION: Confirm box save
        console.log('[RALPH RL-003] Box layout saved:', {
          boxId,
          position: layout.position,
          size: layout.size,
        })
      } catch (error) {
        console.error('[RALPH RL-003] Failed to save box layout:', error)
      }
      return newLayout
    })
  }, [])

  // Reset to defaults
  const resetLayout = useCallback(() => {
    setSavedLayout(DEFAULT_LAYOUTS)
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('[RALPH RL-003] Layout reset to defaults')
    } catch (error) {
      console.error('[RALPH RL-003] Failed to reset layout:', error)
    }
  }, [])

  return {
    savedLayout,
    saveLayout,
    saveBoxLayout,
    resetLayout,
    isLoaded,
  }
}
