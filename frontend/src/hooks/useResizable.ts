import { useState, useCallback, useEffect } from 'react'

export interface Size {
  width: number
  height: number
}

export interface SizeConstraints {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export interface ResizeHandlers {
  onResizeStart: () => void
  onResize: (e: React.SyntheticEvent, data: { size: Size }) => void
  onResizeStop: (e: React.SyntheticEvent, data: { size: Size }) => void
}

export interface UseResizableReturn {
  size: Size
  isResizing: boolean
  resizeHandlers: ResizeHandlers
  setSize: (size: Size) => void
}

interface UseResizableOptions {
  initialSize?: Size
  constraints?: SizeConstraints
  onResizeStart?: () => void
  onResizeEnd?: (size: Size) => void
  onSizeChange?: (size: Size) => void
  disabled?: boolean
}

export function useResizable(options: UseResizableOptions = {}): UseResizableReturn {
  const {
    initialSize = { width: 400, height: 300 },
    constraints = {},
    onResizeStart,
    onResizeEnd,
    onSizeChange,
    disabled = false,
  } = options

  const {
    minWidth = 200,
    minHeight = 150,
    maxWidth = window.innerWidth,
    maxHeight = window.innerHeight,
  } = constraints

  const [size, setSizeState] = useState<Size>(initialSize)
  const [isResizing, setIsResizing] = useState(false)

  // RALPH LOOP 2 VALIDATION: Log resize state
  useEffect(() => {
    if (isResizing) {
      console.log('[RALPH RL-002] Resize started:', { size, isResizing })
    }
  }, [isResizing])

  const constrainSize = useCallback((newSize: Size): Size => {
    return {
      width: Math.max(minWidth, Math.min(newSize.width, maxWidth)),
      height: Math.max(minHeight, Math.min(newSize.height, maxHeight)),
    }
  }, [minWidth, minHeight, maxWidth, maxHeight])

  const setSize = useCallback((newSize: Size) => {
    const constrained = constrainSize(newSize)
    setSizeState(constrained)
    onSizeChange?.(constrained)
  }, [constrainSize, onSizeChange])

  const handleResizeStart = useCallback(() => {
    if (disabled) return
    setIsResizing(true)
    onResizeStart?.()
  }, [disabled, onResizeStart])

  const handleResize = useCallback((_e: React.SyntheticEvent, data: { size: Size }) => {
    if (disabled) return
    const constrained = constrainSize(data.size)
    setSizeState(constrained)
    onSizeChange?.(constrained)
  }, [disabled, constrainSize, onSizeChange])

  const handleResizeStop = useCallback((_e: React.SyntheticEvent, data: { size: Size }) => {
    setIsResizing(false)
    const constrained = constrainSize(data.size)
    setSizeState(constrained)
    onResizeEnd?.(constrained)

    // RALPH LOOP 2 VALIDATION: Confirm resize end
    console.log('[RALPH RL-002] Resize ended:', {
      finalSize: constrained,
      withinConstraints: constrained.width >= minWidth && constrained.height >= minHeight
    })
  }, [constrainSize, onResizeEnd, minWidth, minHeight])

  return {
    size,
    isResizing,
    resizeHandlers: {
      onResizeStart: handleResizeStart,
      onResize: handleResize,
      onResizeStop: handleResizeStop,
    },
    setSize,
  }
}

// Additional hook for constraint checking
export function useSizeConstraints(size: Size, constraints: SizeConstraints) {
  const { minWidth = 200, minHeight = 150, maxWidth, maxHeight } = constraints

  const isAtMin = size.width <= minWidth || size.height <= minHeight
  const isAtMax = (maxWidth && size.width >= maxWidth) || (maxHeight && size.height >= maxHeight)

  const constrainedSize = {
    width: Math.max(minWidth, Math.min(size.width, maxWidth || Infinity)),
    height: Math.max(minHeight, Math.min(size.height, maxHeight || Infinity)),
  }

  return { constrainedSize, isAtMin, isAtMax }
}
