import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface DataPoint {
  date: string;
  value: number;
}

interface MetricsChartProps {
  data: DataPoint[];
  title: string;
  color?: string;
  height?: number;
}

const MetricsChart: React.FC<MetricsChartProps> = ({
  data,
  title,
  color = '#4caf50',
  height = 300,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="metrics-chart">
      <h3 className="chart-title">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #eee)" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--text-secondary, #666)" fontSize={12} />
          <YAxis tickFormatter={formatValue} stroke="var(--text-secondary, #666)" fontSize={12} />
          <Tooltip
            formatter={(value: number) => [formatValue(value), title]}
            labelFormatter={formatDate}
            contentStyle={{ backgroundColor: 'var(--bg-secondary, white)', border: '1px solid var(--border-color, #eee)' }}
          />
          <Legend />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} name={title} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;
