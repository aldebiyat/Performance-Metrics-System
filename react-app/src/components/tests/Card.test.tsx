import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Card from '../Card';

describe('Card Component', () => {
  it('renders the card with positive week-over-week change', () => {
    render(
      <Card
        metricName="Sessions (Site Traffic)"
        metricCount={1000}
        percentile={90}
        weekOverWeekChange={5}
      />
    );

    expect(screen.getByText('Sessions (Site Traffic)')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument(); // Fixed: formatted with comma
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByAltText('Up')).toBeInTheDocument(); // Fixed: was 'Icon'
  });

  it('renders the card with negative week-over-week change', () => {
    render(
      <Card
        metricName="Bounce Rate"
        metricCount={30}
        percentile={75}
        weekOverWeekChange={-3}
      />
    );

    expect(screen.getByText('Bounce Rate')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByAltText('Down')).toBeInTheDocument(); // Fixed: was 'Icon'
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(
      <Card
        metricName="Test"
        metricCount={0}
        percentile={0}
        weekOverWeekChange={0}
        isLoading={true}
      />
    );

    expect(screen.queryByText('Test')).not.toBeInTheDocument();
    expect(document.querySelector('.card-skeleton')).toBeInTheDocument();
  });

  it('handles null percentile gracefully', () => {
    render(
      <Card
        metricName="Test Metric"
        metricCount={100}
        percentile={null}
        weekOverWeekChange={0}
      />
    );

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
