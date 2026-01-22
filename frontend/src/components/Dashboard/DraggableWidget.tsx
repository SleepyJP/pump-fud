import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useDashboard } from './DashboardState';
import './Dashboard.css';

interface DraggableWidgetProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  collapsible?: boolean;
  className?: string;
}

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  id,
  title,
  children,
  defaultWidth = 300,
  defaultHeight = 200,
  minWidth = 150,
  minHeight = 100,
  resizable = true,
  collapsible = true,
  className = '',
}) => {
  const {
    isLocked, getWidgetPosition, updateWidgetPosition,
    toggleWidgetExpand, toggleWidgetMinimize, bringToFront, registerWidget,
  } = useDashboard();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const resizeStart = useRef({ width: 0, height: 0, startX: 0, startY: 0 });

  useEffect(() => {
    registerWidget(id, {
      x: 20, y: 120, width: defaultWidth, height: defaultHeight,
      expanded: true, minimized: false, zIndex: 10,
    });
  }, [id, defaultWidth, defaultHeight, registerWidget]);

  const position = getWidgetPosition(id);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked || isResizing) return;
    if ((e.target as HTMLElement).closest('.widget-controls')) return;

    e.preventDefault();
    setIsDragging(true);
    bringToFront(id);
    dragStart.current = { x: e.clientX, y: e.clientY, startX: position.x, startY: position.y };

    const handleMove = (e: MouseEvent) => {
      updateWidgetPosition(id, {
        x: Math.max(0, dragStart.current.startX + e.clientX - dragStart.current.x),
        y: Math.max(0, dragStart.current.startY + e.clientY - dragStart.current.y),
      });
    };

    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    bringToFront(id);
    resizeStart.current = { width: position.width, height: position.height, startX: e.clientX, startY: e.clientY };

    const handleMove = (e: MouseEvent) => {
      updateWidgetPosition(id, {
        width: Math.max(minWidth, resizeStart.current.width + e.clientX - resizeStart.current.startX),
        height: Math.max(minHeight, resizeStart.current.height + e.clientY - resizeStart.current.startY),
      });
    };

    const handleUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      className={`draggable-widget ${isDragging ? 'dragging' : ''} ${isLocked ? 'locked' : ''} ${className}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: position.minimized ? 200 : position.width,
        height: position.minimized ? 40 : (position.expanded ? position.height : 40),
        zIndex: position.zIndex,
        transition: isDragging || isResizing ? 'none' : 'width 0.2s, height 0.2s',
      }}
    >
      <div className="widget-header" onMouseDown={handleMouseDown} style={{ cursor: isLocked ? 'default' : 'move' }}>
        <div className="widget-title">
          <span className="widget-indicator">●</span>
          {title}
        </div>
        <div className="widget-controls">
          {collapsible && (
            <>
              <button className="widget-btn" onClick={() => toggleWidgetMinimize(id)}>
                {position.minimized ? '□' : '−'}
              </button>
              <button className="widget-btn" onClick={() => toggleWidgetExpand(id)}>
                {position.expanded ? '▼' : '▲'}
              </button>
            </>
          )}
        </div>
      </div>
      {!position.minimized && position.expanded && <div className="widget-content">{children}</div>}
      {resizable && !isLocked && !position.minimized && position.expanded && (
        <div className="resize-handle" onMouseDown={handleResizeStart} />
      )}
    </div>
  );
};

export default DraggableWidget;
