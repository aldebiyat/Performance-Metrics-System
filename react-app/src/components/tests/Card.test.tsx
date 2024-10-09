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
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('90%')).toHaveStyle('color: green');
    expect(screen.getByAltText('Icon')).toBeInTheDocument();
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
    expect(screen.getByText('75%')).toHaveStyle('color: red');
    expect(screen.getByAltText('Icon')).toBeInTheDocument();
  });
});