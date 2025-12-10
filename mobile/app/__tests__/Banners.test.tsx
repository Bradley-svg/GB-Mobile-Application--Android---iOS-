import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GlobalErrorBanner } from '../components/GlobalErrorBanner';
import { OfflineBanner } from '../components/OfflineBanner';
import { RoleRestrictedHint } from '../components/RoleRestrictedHint';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';
import { useAuthStore } from '../store/authStore';

const renderWithTheme = (ui: React.ReactElement) =>
  render(
    <ThemeContext.Provider
      value={{
        theme: lightTheme,
        mode: 'light',
        resolvedScheme: 'light',
        setMode: jest.fn(),
        isReady: true,
      }}
    >
      {ui}
    </ThemeContext.Provider>
  );

describe('Shared banners and role hints', () => {
  afterEach(() => {
    act(() => {
      useAuthStore.setState({ user: null });
    });
  });

  it('renders global error banner with retry action', () => {
    const onRetry = jest.fn();
    renderWithTheme(
      <GlobalErrorBanner
        message="Something failed"
        onRetry={onRetry}
        retryLabel="Try again"
        testID="global-error"
      />
    );

    expect(screen.getByText('Something failed')).toBeTruthy();
    fireEvent.press(screen.getByTestId('global-error-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows offline banner metadata and action', () => {
    const onAction = jest.fn();
    renderWithTheme(
      <OfflineBanner
        message="Offline mode"
        lastUpdatedLabel="10:00"
        actionLabel="Refresh"
        onAction={onAction}
        testID="offline-banner"
      />
    );

    expect(screen.getByText('Offline mode')).toBeTruthy();
    expect(screen.getByText(/10:00/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('offline-banner-action'));
    expect(onAction).toHaveBeenCalled();
  });

  it('shows role restriction message for contractors', () => {
    act(() => {
      useAuthStore.setState({
        user: { id: '1', email: 'c@example.com', name: 'Contractor', role: 'contractor' },
      });
    });
    renderWithTheme(
      <RoleRestrictedHint action="change setpoints" testID="role-hint" />
    );

    expect(screen.getByTestId('role-hint')).toBeTruthy();
    expect(screen.getByText(/Contractor accounts cannot change setpoints/i)).toBeTruthy();
  });

  it('hides role restriction message for admins', () => {
    act(() => {
      useAuthStore.setState({
        user: { id: '2', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });
    });
    renderWithTheme(<RoleRestrictedHint action="export data" testID="role-hint-admin" />);

    expect(screen.queryByTestId('role-hint-admin')).toBeNull();
  });
});
