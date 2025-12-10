import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTwoFactorConfirm,
  useTwoFactorDisable,
  useTwoFactorSetup,
} from '../api/auth/hooks';
import { TwoFactorSetupScreen } from '../screens/Profile/TwoFactorSetupScreen';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';
import { useAuthStore } from '../store/authStore';
import * as navigation from '@react-navigation/native';

jest.mock('../api/auth/hooks', () => ({
  useTwoFactorSetup: jest.fn(),
  useTwoFactorConfirm: jest.fn(),
  useTwoFactorDisable: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(),
  };
});

const renderWithProviders = (ui: React.ReactElement, navigationOverrides?: Record<string, unknown>) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (navigation.useNavigation as jest.Mock).mockReturnValue({
    goBack: jest.fn(),
    navigate: jest.fn(),
    ...navigationOverrides,
  });

  return render(
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
};

describe('TwoFactorSetupScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'user-1', email: 'demo@example.com', name: 'Demo User', two_factor_enabled: false },
      isHydrated: true,
      sessionExpired: false,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
    });
    jest.clearAllMocks();
  });

  it('renders secret and confirms 2FA', async () => {
    const goBack = jest.fn();
    const setup = jest.fn((_, options) => options?.onSuccess?.({ secret: 'ABC123', otpauthUrl: 'otpauth://demo' }));
    (useTwoFactorSetup as jest.Mock).mockReturnValue({ mutate: setup, isPending: false });
    const confirmAsync = jest.fn().mockResolvedValue({ enabled: true });
    (useTwoFactorConfirm as jest.Mock).mockReturnValue({ mutateAsync: confirmAsync, isPending: false });
    (useTwoFactorDisable as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    renderWithProviders(<TwoFactorSetupScreen />, { goBack });

    expect(await screen.findByTestId('twofactor-secret-box')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('twofactor-setup-code'), '123456');
    fireEvent.press(screen.getByTestId('twofactor-setup-submit'));

    await waitFor(() => expect(confirmAsync).toHaveBeenCalledWith({ code: '123456' }));
    expect(goBack).toHaveBeenCalled();
    expect(useAuthStore.getState().user?.two_factor_enabled).toBe(true);
  });

  it('allows disabling 2FA when enabled', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { ...(state.user as NonNullable<typeof state.user>), two_factor_enabled: true },
    }));
    const setup = jest.fn((_, options) => options?.onSuccess?.({ secret: 'SECRET', otpauthUrl: 'otpauth://demo' }));
    (useTwoFactorSetup as jest.Mock).mockReturnValue({ mutate: setup, isPending: false });
    (useTwoFactorConfirm as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    const disableAsync = jest.fn().mockResolvedValue({ enabled: false });
    (useTwoFactorDisable as jest.Mock).mockReturnValue({ mutateAsync: disableAsync, isPending: false });

    renderWithProviders(<TwoFactorSetupScreen />);

    fireEvent.press(await screen.findByTestId('twofactor-disable'));

    await waitFor(() => expect(disableAsync).toHaveBeenCalled());
    expect(useAuthStore.getState().user?.two_factor_enabled).toBe(false);
  });

  it('shows error when setup fails to start', async () => {
    const setup = jest.fn((_, options) =>
      options?.onError?.(
        new AxiosError('failed', undefined, undefined, undefined, {
          status: 400,
          statusText: 'Bad Request',
          headers: {} as Record<string, string>,
          config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
          data: { message: 'Two-factor authentication is disabled' },
        })
      )
    );
    (useTwoFactorSetup as jest.Mock).mockReturnValue({ mutate: setup, isPending: false });
    (useTwoFactorConfirm as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useTwoFactorDisable as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    renderWithProviders(<TwoFactorSetupScreen />);

    expect(await screen.findByText(/Two-factor authentication is disabled/i)).toBeTruthy();
  });
});
