import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Resizable } from 're-resizable'
import { useDraggable, type Position } from '../../hooks/useDraggable'
import { useResizable, type Size } from '../../hooks/useResizable'

export interface DraggableResizableBoxProps {
  id: string
  defaultPosition: Position
  defaultSize: Size
  minSize?: { width: number; height: number }
  maxSize?: { width: number; height: number }
  children: ReactNode
  onPositionChange?: (pos: Position) => void
  onSizeChange?: (size: Size) => void
  zIndex?: number
  onFocus?: () => void
  title?: string
  headerContent?: ReactNode
  disabled?: boolean
  style?: React.CSSProperties
}

export function DraggableResizableBox({
  id,
  defaultPosition,
  defaultSize,
  minSize = { width: 250, height: 200 },
  maxSize,
  children,
  onPositionChange,
  onSizeChange,
  zIndex = 10,
  onFocus,
  title,
  headerContent,
  disabled = false,
  style,
}: DraggableResizableBoxProps) {
  const [isHovered, setIsHovered] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Draggable state
  const {
    position,
    isDragging,
    dragHandlers,
    setPosition,
  } = useDraggable({
    initialPosition: defaultPosition,
    boundToViewport: true,
    onDragEnd: (pos) => {
      onPositionChange?.(pos)
      // RALPH VALIDATION
      console.log(`[RALPH RL-001] Box ${id} dragged to:`, pos)
    },
    disabled,
  })

  // Resizable state
  const {
    size,
    isResizing,
    setSize,
  } = useResizable({
    initialSize: defaultSize,
    constraints: {
      minWidth: minSize.width,
      minHeight: minSize.height,
      maxWidth: maxSize?.width,
      maxHeight: maxSize?.height,
    },
    onResizeEnd: (newSize) => {
      onSizeChange?.(newSize)
      // RALPH VALIDATION
      console.log(`[RALPH RL-002] Box ${id} resized to:`, newSize)
    },
    disabled,
  })

  // Handle focus/click to bring to front
  const handleFocus = useCallback(() => {
    onFocus?.()
    // RALPH VALIDATION
    console.log(`[RALPH RL-004] Box ${id} focused, zIndex:`, zIndex)
  }, [onFocus, id, zIndex])

  // Sync with external position/size changes
  useEffect(() => {
    if (defaultPosition.x !== position.x || defaultPosition.y !== position.y) {
      setPosition(defaultPosition)
    }
  }, [defaultPosition])

  useEffect(() => {
    if (defaultSize.width !== size.width || defaultSize.height !== size.height) {
      setSize(defaultSize)
    }
  }, [defaultSize])

  return (
    <div
      ref={boxRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: isDragging || isResizing ? zIndex + 100 : zIndex,
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease',
        ...style,
      }}
      onMouseDown={handleFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Resizable
        size={{ width: size.width, height: size.height }}
        minWidth={minSize.width}
        minHeight={minSize.height}
        maxWidth={maxSize?.width}
        maxHeight={maxSize?.height}
        onResizeStart={() => {
          console.log(`[RALPH RL-002] Box ${id} resize start`)
        }}
        onResize={(_e, _direction, _ref, d) => {
          setSize({
            width: size.width + d.width,
            height: size.height + d.height,
          })
        }}
        onResizeStop={(_e, _direction, _ref, d) => {
          const newSize = {
            width: size.width + d.width,
            height: size.height + d.height,
          }
          setSize(newSize)
          onSizeChange?.(newSize)
        }}
        enable={disabled ? {} : {
          top: false,
          right: true,
          bottom: true,
          left: false,
          topRight: false,
          bottomRight: true,
          bottomLeft: false,
          topLeft: false,
        }}
        handleStyles={{
          bottomRight: {
            width: '20px',
            height: '20px',
            right: '0',
            bottom: '0',
            cursor: 'se-resize',
          },
        }}
        handleComponent={{
          bottomRight: (
            <div
              style={{
                width: '20px',
                height: '20px',
                position: 'absolute',
                right: 0,
                bottom: 0,
                cursor: 'se-resize',
                opacity: isHovered || isResizing ? 1 : 0.3,
                transition: 'opacity 0.2s',
              }}
            >
              {/* Resize grip lines */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                }}
              >
                <line x1="12" y1="16" x2="16" y2="12" stroke="rgba(0,255,0,0.5)" strokeWidth="1.5" />
                <line x1="8" y1="16" x2="16" y2="8" stroke="rgba(0,255,0,0.5)" strokeWidth="1.5" />
                <line x1="4" y1="16" x2="16" y2="4" stroke="rgba(0,255,0,0.5)" strokeWidth="1.5" />
              </svg>
            </div>
          ),
        }}
        style={{
          backgroundColor: 'rgba(26,26,26,0.95)',
          border: `1px solid ${isDragging || isResizing ? 'rgba(0,255,0,0.5)' : 'rgba(0,255,0,0.15)'}`,
          borderRadius: '12px',
          boxShadow: isDragging || isResizing
            ? '0 8px 32px rgba(0,255,0,0.2), 0 0 0 1px rgba(0,255,0,0.3)'
            : '0 4px 16px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag Handle Header */}
        {(title || headerContent) && (
          <div
            {...dragHandlers}
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderBottom: '1px solid rgba(0,255,0,0.1)',
              cursor: disabled ? 'default' : 'grab',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            {title && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff00',
                  boxShadow: '0 0 8px rgba(0,255,0,0.6)',
                }} />
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {title}
                </span>
              </div>
            )}
            {headerContent}
          </div>
        )}

        {/* Box Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}>
          {children}
        </div>

        {/* Drag indicator when dragging */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,255,0,0.05)',
            pointerEvents: 'none',
            borderRadius: '12px',
          }} />
        )}
      </Resizable>
    </div>
  )
}
