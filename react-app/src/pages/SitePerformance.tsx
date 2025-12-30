import React from 'react';
import Card from '../components/Card';
import ErrorBanner from '../components/ErrorBanner';
import { useMetrics } from '../hooks/useMetrics';
import { DateRange } from '../types';

interface SitePerformanceProps {
  dateRange: DateRange;
}

const SitePerformance: React.FC<SitePerformanceProps> = ({ dateRange }) => {
  const { data, isLoading, error, refetch, lastUpdated } = useMetrics({
    category: 'performance',
    range: dateRange,
  });

  return (
    <div className="site-performance">
      {error && (
        <ErrorBanner
          message={error}
          onRetry={refetch}
          onDismiss={() => {}}
        />
      )}

      {lastUpdated && !isLoading && (
        <p className="last-updated">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      <div className="card-container">
        {isLoading && !data ? (
          <>
            <Card metricName="" metricCount={0} percentile={0} weekOverWeekChange={0} isLoading />
            <Card metricName="" metricCount={0} percentile={0} weekOverWeekChange={0} isLoading />
            <Card metricName="" metricCount={0} percentile={0} weekOverWeekChange={0} isLoading />
            <Card metricName="" metricCount={0} percentile={0} weekOverWeekChange={0} isLoading />
          </>
        ) : data?.metrics ? (
          data.metrics.map((metric) => (
            <Card
              key={metric.id}
              metricName={metric.name}
              metricCount={metric.count}
              percentile={metric.percentile}
              weekOverWeekChange={metric.weekOverWeekChange}
            />
          ))
        ) : null}
      </div>
    </div>
  );
};

export default SitePerformance;
