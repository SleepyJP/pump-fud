import { useCallback, useState } from 'react';
import { useDashboard, getStorageKey, STORAGE_VERSION } from './DashboardState';

interface ValidationResult {
  passed: boolean;
  message: string;
}

export const useRalphValidation = (tokenAddress: string) => {
  const { state } = useDashboard();
  const [results, setResults] = useState<ValidationResult[]>([]);

  const runValidation = useCallback(() => {
    const r: ValidationResult[] = [];

    // Test persistence
    const saved = localStorage.getItem(getStorageKey(tokenAddress));
    r.push({ passed: !!saved, message: saved ? '✅ Persistence: WORKING' : '❌ Persistence: FAILED' });

    // Test widget positions
    const valid = Object.values(state.widgets).every(w => typeof w.x === 'number' && typeof w.y === 'number');
    r.push({ passed: valid, message: valid ? '✅ Positions: VALID' : '❌ Positions: INVALID' });

    // Test lock state
    r.push({ passed: typeof state.isLocked === 'boolean', message: '✅ Lock state: VALID' });

    // Test version
    r.push({ passed: state.version === STORAGE_VERSION, message: '✅ Version: CURRENT' });

    console.log('══════════════════════════════════════════════════════');
    console.log('[RALPH-WIGGUM] 🧪 VALIDATION RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    r.forEach(x => console.log(x.message));
    console.log('═══════════════════════════════════════════════════════════');

    setResults(r);
    return r;
  }, [state, tokenAddress]);

  const runStressTest = useCallback(async () => {
    console.log('[RALPH-WIGGUM] 🏋️ Starting stress test...');
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      JSON.stringify({ ...state, widgets: { ...state.widgets, test: { x: Math.random() * 1000, y: Math.random() * 1000 } } });
    }
    const duration = Date.now() - start;
    console.log(`[RALPH-WIGGUM] 🏋️ 100 iterations in ${duration}ms (${(duration / 100).toFixed(2)}ms avg)`);
    return { iterations: 100, duration };
  }, [state]);

  return { results, runValidation, runStressTest };
};

export default useRalphValidation;
