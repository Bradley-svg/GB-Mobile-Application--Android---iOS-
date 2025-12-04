import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AlertsScreen } from './AlertsScreen';
import { useAlerts } from '../../api/hooks';

jest.mock('../../api/hooks');

describe('AlertsScreen states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error card with retry', () => {
    const refetchMock = jest.fn();
    (useAlerts as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });

    render(<AlertsScreen />);

    fireEvent.press(screen.getByText('Retry'));
    expect(refetchMock).toHaveBeenCalled();
    expect(screen.getByTestId('alerts-error')).toBeTruthy();
  });

  it('shows empty state when no alerts', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<AlertsScreen />);

    expect(screen.getByTestId('alerts-empty')).toBeTruthy();
  });
});
