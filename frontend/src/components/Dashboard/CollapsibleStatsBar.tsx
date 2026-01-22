import { useState } from 'react';
import './Dashboard.css';

interface StatsBarProps {
  totalSupply: string;
  tokensSold: string;
  yourBalance: string;
  yourHoldings: string;
  creator: string;
}

export const CollapsibleStatsBar: React.FC<StatsBarProps> = ({
  totalSupply, tokensSold, yourBalance, yourHoldings, creator,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`stats-bar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="stats-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
        {isCollapsed ? '▼' : '▲'}
      </button>
      {!isCollapsed ? (
        <div className="stats-content">
          <div className="stat-item">
            <span className="stat-indicator">●</span>
            <span className="stat-value">{totalSupply}</span>
            <span className="stat-label">TOTAL SUPPLY</span>
          </div>
          <div className="stat-item">
            <span className="stat-indicator">●</span>
            <span className="stat-value">{tokensSold}</span>
            <span className="stat-label">TOKENS SOLD</span>
          </div>
          <div className="stat-item">
            <span className="stat-indicator">●</span>
            <span className="stat-value">{yourBalance}</span>
            <span className="stat-label">YOUR BALANCE</span>
          </div>
          <div className="stat-item highlight">
            <span className="stat-value green">{yourHoldings}</span>
            <span className="stat-label">YOUR HOLDINGS</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{creator}</span>
            <span className="stat-label">CREATOR</span>
          </div>
        </div>
      ) : (
        <div className="stats-collapsed-hint">Click to show stats</div>
      )}
    </div>
  );
};

export default CollapsibleStatsBar;
