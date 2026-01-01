import React from 'react';
import Card from '../components/Card';
import ErrorBanner from '../components/ErrorBanner';
import MetricsChart from '../components/MetricsChart';
import { useMetrics } from '../hooks/useMetrics';
import { DateRange } from '../types';

// Sample chart data for demonstration
const sampleChartData = [
  { date: '2024-01-01', value: 4200 },
  { date: '2024-01-08', value: 4800 },
  { date: '2024-01-15', value: 5100 },
  { date: '2024-01-22', value: 4900 },
  { date: '2024-01-29', value: 5500 },
  { date: '2024-02-05', value: 6200 },
  { date: '2024-02-12', value: 5800 },
  { date: '2024-02-19', value: 6500 },
  { date: '2024-02-26', value: 7100 },
  { date: '2024-03-04', value: 6800 },
];

interface OverviewProps {
  dateRange: DateRange;
}

const Overview: React.FC<OverviewProps> = ({ dateRange }) => {
  const { data, isLoading, error, refetch, lastUpdated } = useMetrics({
    category: 'overview',
    range: dateRange,
  });

  return (
    <div className="overview">
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
          // Show skeleton cards while loading
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

      {/* Sample Interactive Chart */}
      <MetricsChart
        data={sampleChartData}
        title="Performance Trend"
        color="#4caf50"
        height={300}
      />
    </div>
  );
};

export default Overview;
