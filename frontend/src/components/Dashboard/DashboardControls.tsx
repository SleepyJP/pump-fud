import { useDashboard } from './DashboardState';
import './Dashboard.css';

export const DashboardControls: React.FC = () => {
  const { isLocked, toggleLock, resetLayout } = useDashboard();

  return (
    <div className="dashboard-controls">
      <button className={`control-btn lock-btn ${isLocked ? 'locked' : ''}`} onClick={toggleLock}>
        {isLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
      </button>
      <button className="control-btn reset-btn" onClick={resetLayout}>
        🔄 RESET
      </button>
    </div>
  );
};

export default DashboardControls;
