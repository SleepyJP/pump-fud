import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { useLayoutPersistence, type LayoutState, type BoxLayout } from '../hooks/useLayoutPersistence'
import { useZIndexManager, type ZIndexMap } from '../hooks/useZIndexManager'
import type { Position } from '../hooks/useDraggable'
import type { Size } from '../hooks/useResizable'

interface LayoutContextValue {
  // Layout state
  layouts: LayoutState
  isLoaded: boolean

  // Position/size management
  getBoxLayout: (boxId: string) => BoxLayout | undefined
  updateBoxPosition: (boxId: string, position: Position) => void
  updateBoxSize: (boxId: string, size: Size) => void
  updateBoxLayout: (boxId: string, layout: Partial<BoxLayout>) => void

  // Z-index management
  getZIndex: (boxId: string) => number
  bringToFront: (boxId: string) => void
  zIndexMap: ZIndexMap

  // Reset
  resetLayout: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

interface LayoutProviderProps {
  children: ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const {
    savedLayout,
    saveBoxLayout,
    resetLayout,
    isLoaded,
  } = useLayoutPersistence()

  const {
    getZIndex,
    bringToFront,
    zIndexMap,
  } = useZIndexManager()

  const getBoxLayout = useCallback((boxId: string): BoxLayout | undefined => {
    return savedLayout[boxId]
  }, [savedLayout])

  const updateBoxPosition = useCallback((boxId: string, position: Position) => {
    const current = savedLayout[boxId]
    if (current) {
      saveBoxLayout(boxId, { ...current, position })
    }
  }, [savedLayout, saveBoxLayout])

  const updateBoxSize = useCallback((boxId: string, size: Size) => {
    const current = savedLayout[boxId]
    if (current) {
      saveBoxLayout(boxId, { ...current, size })
    }
  }, [savedLayout, saveBoxLayout])

  const updateBoxLayout = useCallback((boxId: string, layout: Partial<BoxLayout>) => {
    const current = savedLayout[boxId]
    if (current) {
      saveBoxLayout(boxId, { ...current, ...layout })
    }
  }, [savedLayout, saveBoxLayout])

  const value: LayoutContextValue = {
    layouts: savedLayout,
    isLoaded,
    getBoxLayout,
    updateBoxPosition,
    updateBoxSize,
    updateBoxLayout,
    getZIndex,
    bringToFront,
    zIndexMap,
    resetLayout,
  }

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
