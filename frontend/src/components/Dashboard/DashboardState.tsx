/**
 * PUMP.FUD DASHBOARD STATE MANAGEMENT SYSTEM
 * Draggable widgets, persistent layouts, lock functionality
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  expanded: boolean;
  minimized: boolean;
  zIndex: number;
}

interface DashboardState {
  widgets: Record<string, WidgetPosition>;
  isLocked: boolean;
  lastModified: number;
  version: string;
}

interface DashboardContextType {
  state: DashboardState;
  isLocked: boolean;
  toggleLock: () => void;
  updateWidgetPosition: (id: string, position: Partial<WidgetPosition>) => void;
  toggleWidgetExpand: (id: string) => void;
  toggleWidgetMinimize: (id: string) => void;
  bringToFront: (id: string) => void;
  resetLayout: () => void;
  getWidgetPosition: (id: string) => WidgetPosition;
  registerWidget: (id: string, defaultPosition: WidgetPosition) => void;
}

const STORAGE_VERSION = '1.0.0';

const getStorageKey = (tokenAddress: string): string => {
  return `pump_fud_dashboard_${tokenAddress.toLowerCase()}`;
};

const DEFAULT_POSITIONS: Record<string, WidgetPosition> = {
  'price-chart': { x: 20, y: 120, width: 320, height: 280, expanded: true, minimized: false, zIndex: 10 },
  'trade-widget': { x: 360, y: 120, width: 200, height: 280, expanded: true, minimized: false, zIndex: 10 },
  'transaction-feed': { x: 20, y: 420, width: 260, height: 200, expanded: true, minimized: false, zIndex: 10 },
  'message-board': { x: 300, y: 420, width: 480, height: 340, expanded: true, minimized: false, zIndex: 10 },
};

const saveToStorage = (tokenAddress: string, state: DashboardState): void => {
  try {
    localStorage.setItem(getStorageKey(tokenAddress), JSON.stringify({
      ...state,
      lastModified: Date.now(),
      version: STORAGE_VERSION,
    }));
    console.log('[RALPH] ✅ Dashboard saved');
  } catch (e) {
    console.error('[RALPH] ❌ Save failed:', e);
  }
};

const loadFromStorage = (tokenAddress: string): DashboardState | null => {
  try {
    const data = localStorage.getItem(getStorageKey(tokenAddress));
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.version !== STORAGE_VERSION) return null;
    console.log('[RALPH] ✅ Layout loaded');
    return parsed;
  } catch (e) {
    return null;
  }
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardProvider: React.FC<{ children: ReactNode; tokenAddress: string }> = ({
  children,
  tokenAddress,
}) => {
  const [state, setState] = useState<DashboardState>(() => {
    const saved = loadFromStorage(tokenAddress);
    return saved || {
      widgets: { ...DEFAULT_POSITIONS },
      isLocked: false,
      lastModified: Date.now(),
      version: STORAGE_VERSION,
    };
  });

  const maxZIndexRef = useRef(100);

  useEffect(() => {
    const timeout = setTimeout(() => saveToStorage(tokenAddress, state), 500);
    return () => clearTimeout(timeout);
  }, [state, tokenAddress]);

  useEffect(() => {
    const saved = loadFromStorage(tokenAddress);
    setState(saved || {
      widgets: { ...DEFAULT_POSITIONS },
      isLocked: false,
      lastModified: Date.now(),
      version: STORAGE_VERSION,
    });
  }, [tokenAddress]);

  const toggleLock = useCallback(() => {
    setState(prev => ({ ...prev, isLocked: !prev.isLocked }));
  }, []);

  const updateWidgetPosition = useCallback((id: string, position: Partial<WidgetPosition>) => {
    setState(prev => {
      if (prev.isLocked) return prev;
      return {
        ...prev,
        widgets: { ...prev.widgets, [id]: { ...prev.widgets[id], ...position } },
      };
    });
  }, []);

  const toggleWidgetExpand = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      widgets: { ...prev.widgets, [id]: { ...prev.widgets[id], expanded: !prev.widgets[id]?.expanded } },
    }));
  }, []);

  const toggleWidgetMinimize = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      widgets: { ...prev.widgets, [id]: { ...prev.widgets[id], minimized: !prev.widgets[id]?.minimized } },
    }));
  }, []);

  const bringToFront = useCallback((id: string) => {
    maxZIndexRef.current += 1;
    setState(prev => ({
      ...prev,
      widgets: { ...prev.widgets, [id]: { ...prev.widgets[id], zIndex: maxZIndexRef.current } },
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setState({
      widgets: { ...DEFAULT_POSITIONS },
      isLocked: false,
      lastModified: Date.now(),
      version: STORAGE_VERSION,
    });
  }, []);

  const getWidgetPosition = useCallback((id: string): WidgetPosition => {
    return state.widgets[id] || DEFAULT_POSITIONS[id] || {
      x: 0, y: 0, width: 300, height: 200, expanded: true, minimized: false, zIndex: 10,
    };
  }, [state.widgets]);

  const registerWidget = useCallback((id: string, defaultPosition: WidgetPosition) => {
    setState(prev => {
      if (prev.widgets[id]) return prev;
      return { ...prev, widgets: { ...prev.widgets, [id]: defaultPosition } };
    });
  }, []);

  return (
    <DashboardContext.Provider value={{
      state, isLocked: state.isLocked, toggleLock, updateWidgetPosition,
      toggleWidgetExpand, toggleWidgetMinimize, bringToFront, resetLayout,
      getWidgetPosition, registerWidget,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};

export { getStorageKey, STORAGE_VERSION };
export type { WidgetPosition, DashboardState };
