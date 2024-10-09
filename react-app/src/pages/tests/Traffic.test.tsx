import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Traffic from '../Traffic';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            'Metric Name': 'Direct Traffic',
            'Metric Count': '500',
            'Week-Over-Week Change': '3',
            'Percentile': '85',
          },
        ]),
    } as Response)
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Traffic Page', () => {
  it('renders traffic metrics data in card components', async () => {
    render(<Traffic />);

    await waitFor(() => screen.getByText('Direct Traffic'));

    expect(screen.getByText('Direct Traffic')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});