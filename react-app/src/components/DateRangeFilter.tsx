import React from 'react';
import { DateRange } from '../types';
import './DateRangeFilter.css';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const ranges: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ value, onChange }) => {
  return (
    <div className="date-range-filter">
      {ranges.map((range) => (
        <button
          key={range.value}
          className={`date-range-btn ${value === range.value ? 'active' : ''}`}
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

export default DateRangeFilter;
