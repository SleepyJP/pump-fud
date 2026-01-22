import { useState, useCallback } from 'react'

const BASE_Z_INDEX = 10
const MAX_Z_INDEX = 1000

export interface ZIndexMap {
  [boxId: string]: number
}

export interface UseZIndexManagerReturn {
  getZIndex: (boxId: string) => number
  bringToFront: (boxId: string) => void
  sendToBack: (boxId: string) => void
  zIndexMap: ZIndexMap
}

export function useZIndexManager(initialMap: ZIndexMap = {}): UseZIndexManagerReturn {
  const [zIndexMap, setZIndexMap] = useState<ZIndexMap>(initialMap)
  const [topIndex, setTopIndex] = useState(BASE_Z_INDEX)

  const getZIndex = useCallback((boxId: string): number => {
    return zIndexMap[boxId] ?? BASE_Z_INDEX
  }, [zIndexMap])

  const bringToFront = useCallback((boxId: string) => {
    setZIndexMap(prev => {
      const newIndex = topIndex + 1

      // RALPH LOOP 4 VALIDATION: Log z-index change
      console.log('[RALPH RL-004] Bring to front:', {
        boxId,
        previousZIndex: prev[boxId] ?? BASE_Z_INDEX,
        newZIndex: newIndex,
      })

      // Prevent z-index from growing indefinitely
      if (newIndex > MAX_Z_INDEX) {
        // Normalize all z-indices
        const boxes = Object.keys(prev)
        const normalized: ZIndexMap = {}
        boxes.forEach((id, index) => {
          normalized[id] = BASE_Z_INDEX + index
        })
        normalized[boxId] = BASE_Z_INDEX + boxes.length
        setTopIndex(BASE_Z_INDEX + boxes.length)
        return normalized
      }

      setTopIndex(newIndex)
      return { ...prev, [boxId]: newIndex }
    })
  }, [topIndex])

  const sendToBack = useCallback((boxId: string) => {
    setZIndexMap(prev => {
      // Find minimum z-index
      const values = Object.values(prev)
      const minZ = values.length > 0 ? Math.min(...values) : BASE_Z_INDEX
      const newZ = Math.max(BASE_Z_INDEX, minZ - 1)

      // RALPH LOOP 4 VALIDATION: Log z-index change
      console.log('[RALPH RL-004] Send to back:', {
        boxId,
        previousZIndex: prev[boxId] ?? BASE_Z_INDEX,
        newZIndex: newZ,
      })

      return { ...prev, [boxId]: newZ }
    })
  }, [])

  return {
    getZIndex,
    bringToFront,
    sendToBack,
    zIndexMap,
  }
}
