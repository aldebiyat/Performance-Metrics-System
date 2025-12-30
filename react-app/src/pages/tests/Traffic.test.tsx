import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Traffic from '../Traffic';

const mockApiResponse = {
  success: true,
  data: {
    category: { id: 2, slug: 'traffic', name: 'Traffic Sources' },
    metrics: [
      {
        id: 5,
        name: 'Direct Traffic',
        slug: 'direct_traffic',
        description: null,
        icon: null,
        count: 500,
        weekOverWeekChange: 3,
        percentile: 85,
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

describe('Traffic Page', () => {
  it('renders traffic metrics data in card components', async () => {
    render(<Traffic dateRange="30d" />);

    await waitFor(() => screen.getByText('Direct Traffic'));

    expect(screen.getByText('Direct Traffic')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});
