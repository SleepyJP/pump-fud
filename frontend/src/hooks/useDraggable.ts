import { useState, useCallback, useRef, useEffect } from 'react'

export interface Position {
  x: number
  y: number
}

export interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
}

export interface UseDraggableReturn {
  position: Position
  isDragging: boolean
  dragHandlers: DragHandlers
  setPosition: (pos: Position) => void
}

interface UseDraggableOptions {
  initialPosition?: Position
  boundToViewport?: boolean
  onDragStart?: () => void
  onDragEnd?: (position: Position) => void
  onPositionChange?: (position: Position) => void
  disabled?: boolean
}

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const {
    initialPosition = { x: 0, y: 0 },
    boundToViewport = true,
    onDragStart,
    onDragEnd,
    onPositionChange,
    disabled = false,
  } = options

  const [position, setPositionState] = useState<Position>(initialPosition)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartPos = useRef<Position>({ x: 0, y: 0 })
  const elementStartPos = useRef<Position>({ x: 0, y: 0 })
  const elementRef = useRef<HTMLElement | null>(null)

  // RALPH LOOP 1 VALIDATION: Log drag state
  useEffect(() => {
    if (isDragging) {
      console.log('[RALPH RL-001] Drag started:', { position, isDragging })
    }
  }, [isDragging])

  const setPosition = useCallback((newPos: Position) => {
    setPositionState(newPos)
    onPositionChange?.(newPos)
  }, [onPositionChange])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (disabled) return

    const deltaX = clientX - dragStartPos.current.x
    const deltaY = clientY - dragStartPos.current.y

    let newX = elementStartPos.current.x + deltaX
    let newY = elementStartPos.current.y + deltaY

    // Bound to viewport if enabled
    if (boundToViewport && elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect()
      const maxX = window.innerWidth - rect.width
      const maxY = window.innerHeight - rect.height

      newX = Math.max(0, Math.min(newX, maxX))
      newY = Math.max(0, Math.min(newY, maxY))
    }

    setPosition({ x: newX, y: newY })
  }, [boundToViewport, disabled, setPosition])

  const handleEnd = useCallback(() => {
    setIsDragging(false)
    onDragEnd?.(position)

    // RALPH LOOP 1 VALIDATION: Confirm drag end
    console.log('[RALPH RL-001] Drag ended:', { finalPosition: position })

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleEnd)
  }, [position, onDragEnd])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault()
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [handleMove])

  const handleStart = useCallback((clientX: number, clientY: number, element: HTMLElement) => {
    if (disabled) return

    setIsDragging(true)
    onDragStart?.()

    dragStartPos.current = { x: clientX, y: clientY }
    elementStartPos.current = { ...position }
    elementRef.current = element

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }, [disabled, position, onDragStart, handleMouseMove, handleEnd, handleTouchMove])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left mouse button
    if (e.button !== 0) return
    e.preventDefault()
    handleStart(e.clientX, e.clientY, e.currentTarget as HTMLElement)
  }, [handleStart])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget as HTMLElement)
    }
  }, [handleStart])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [handleMouseMove, handleEnd, handleTouchMove])

  return {
    position,
    isDragging,
    dragHandlers: { onMouseDown, onTouchStart },
    setPosition,
  }
}
