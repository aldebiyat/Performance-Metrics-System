import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SitePerformance from '../SitePerformance';

// Mocking the global fetch API call for the SitePerformance component
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            'Metric Name': 'Users',
            'Metric Count': '1500',
            'Week-Over-Week Change': '7',
            'Percentile': '95',
          },
          {
            'Metric Name': 'Two or More Sessions',
            'Metric Count': '900',
            'Week-Over-Week Change': '-3',
            'Percentile': '80',
          },
        ]),
    } as Response)
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('SitePerformance Page', () => {
  it('renders site performance metrics data in card components', async () => {
    render(<SitePerformance />);

    // Wait for the data to be rendered
    await waitFor(() => screen.getByText('Users'));

    // Check if the metrics are displayed correctly
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();

    expect(screen.getByText('Two or More Sessions')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});