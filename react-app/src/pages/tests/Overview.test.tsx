import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Overview from '../Overview';

const mockApiResponse = {
  success: true,
  data: {
    category: { id: 1, slug: 'overview', name: 'Overview' },
    metrics: [
      {
        id: 1,
        name: 'Sessions (Site Traffic)',
        slug: 'sessions_site_traffic',
        description: null,
        icon: null,
        count: 1000,
        weekOverWeekChange: 5,
        percentile: 90,
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

describe('Overview Page', () => {
  it('renders overview metrics data in card components', async () => {
    render(<Overview dateRange="30d" />);

    await waitFor(() => screen.getByText('Sessions (Site Traffic)'));

    expect(screen.getByText('Sessions (Site Traffic)')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });
});
