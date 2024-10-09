import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Tabs from '../Tabs';

describe('Tabs Component', () => {
  it('renders the tabs and navigates correctly', () => {
    render(
      <MemoryRouter>
        <Tabs />
      </MemoryRouter>
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Traffic')).toBeInTheDocument();
    expect(screen.getByText('Site Performance')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Traffic'));

    expect(screen.getByText('Traffic')).toHaveClass('active');
  });
});