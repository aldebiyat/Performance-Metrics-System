import React from 'react';
import '../style/Card.css';

interface CardProps {
  metricName: string;
  metricCount: number;
  percentile: number;
  weekOverWeekChange: number;
}

const Card: React.FC<CardProps> = ({ metricName, metricCount, percentile, weekOverWeekChange }) => {
  const iconUrl = weekOverWeekChange >= 0 ? '/assets/BNM_Metric_Up.svg' : '/assets/BNM_Metric_Down.svg';

  return (
    <div className="card">
      <div className="card-header">{metricName}</div>
      <div className="card-body">
        <div className="card-content">
          <span className="metric-count">{metricCount}</span>
          <span className="divider">|</span>
          <span
            className="percentile"
            style={{ color: weekOverWeekChange >= 0 ? 'green' : 'red' }}
          >
            {percentile}%
          </span>
          <img src={iconUrl} alt="Icon" className="card-icon" />
        </div>
      </div>
      <div className="card-footer">
        <p className="performance-text">Your performance from last week {weekOverWeekChange >= 0 ? '+' : ''}{weekOverWeekChange}%</p>
      </div>
    </div>
  );
};

export default Card;