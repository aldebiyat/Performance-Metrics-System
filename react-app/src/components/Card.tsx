import React from 'react';
import '../style/Card.css';

interface CardProps {
  metricName: string;
  metricCount: number;
  percentile: number | null;
  weekOverWeekChange: number | null;
  isLoading?: boolean;
}

const Card: React.FC<CardProps> = ({
  metricName,
  metricCount,
  percentile,
  weekOverWeekChange,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="card card-skeleton">
        <div className="card-header skeleton-text"></div>
        <div className="card-body">
          <div className="card-content">
            <span className="skeleton-text skeleton-count"></span>
          </div>
        </div>
        <div className="card-footer">
          <p className="skeleton-text skeleton-footer"></p>
        </div>
      </div>
    );
  }

  const change = weekOverWeekChange ?? 0;
  const isPositive = change >= 0;
  const iconUrl = isPositive ? '/assets/BNM_Metric_Up.svg' : '/assets/BNM_Metric_Down.svg';

  // Format the count nicely
  const formattedCount = typeof metricCount === 'number'
    ? metricCount.toLocaleString()
    : metricCount;

  return (
    <div className="card">
      <div className="card-header">{metricName}</div>
      <div className="card-body">
        <div className="card-content">
          <span className="metric-count">{formattedCount}</span>
          <span className="divider">|</span>
          <span
            className="percentile"
            style={{ color: isPositive ? 'green' : 'red' }}
          >
            {percentile !== null ? `${percentile}%` : 'N/A'}
          </span>
          <img src={iconUrl} alt={isPositive ? 'Up' : 'Down'} className="card-icon" />
        </div>
      </div>
      <div className="card-footer">
        <p
          className="performance-text"
          style={{ color: isPositive ? '#27ae60' : '#e74c3c' }}
        >
          Your performance from last week {isPositive ? '+' : ''}{change}%
        </p>
      </div>
    </div>
  );
};

export default Card;
