import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Overview from '../Overview';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            'Metric Name': 'Sessions (Site Traffic)',
            'Metric Count': '1000',
            'Week-Over-Week Change': '5',
            'Percentile': '90',
          },
        ]),
    } as Response)
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Overview Page', () => {
  it('renders overview metrics data in card components', async () => {
    render(<Overview />);

    await waitFor(() => screen.getByText('Sessions (Site Traffic)'));

    expect(screen.getByText('Sessions (Site Traffic)')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });
});