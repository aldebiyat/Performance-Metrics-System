import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SitePerformance from '../SitePerformance';

const mockApiResponse = {
  success: true,
  data: {
    category: { id: 3, slug: 'performance', name: 'Site Performance' },
    metrics: [
      {
        id: 9,
        name: 'Users',
        slug: 'users',
        description: null,
        icon: null,
        count: 1500,
        weekOverWeekChange: 7,
        percentile: 95,
        recordedAt: '2025-12-30',
      },
      {
        id: 10,
        name: 'Two or More Sessions',
        slug: 'two_or_more_sessions',
        description: null,
        icon: null,
        count: 900,
        weekOverWeekChange: -3,
        percentile: 80,
        recordedAt: '2025-12-30',
      },
    ],
    dateRange: { from: '2025-12-01', to: '2025-12-30' },
  },
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockApiResponse),
    } as Response)
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('SitePerformance Page', () => {
  it('renders site performance metrics data in card components', async () => {
    render(<SitePerformance dateRange="30d" />);

    await waitFor(() => screen.getByText('Users'));

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();

    expect(screen.getByText('Two or More Sessions')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
