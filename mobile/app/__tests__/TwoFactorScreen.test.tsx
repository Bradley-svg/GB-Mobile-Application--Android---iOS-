import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TwoFactorScreen } from '../screens/Auth/TwoFactorScreen';
import { useLoginTwoFactor } from '../api/auth/hooks';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';
import { useAuthStore } from '../store/authStore';
import * as navigation from '@react-navigation/native';

jest.mock('../api/auth/hooks', () => ({
  useLoginTwoFactor: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn().mockReturnValue({ navigate: jest.fn() }),
    useRoute: jest.fn(),
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (navigation.useRoute as jest.Mock).mockReturnValue({
    params: { challengeToken: 'challenge-123', email: 'demo@example.com' },
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

describe('TwoFactorScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isHydrated: true,
      sessionExpired: false,
      notificationPreferences: { alertsEnabled: true },
      preferencesHydrated: false,
    });
    jest.clearAllMocks();
  });

  it('submits the code and stores auth on success', async () => {
    const mutateAsync = jest.fn(async (payload) => {
      await useAuthStore.getState().setAuth({
        accessToken: 'access-2fa',
        refreshToken: 'refresh-2fa',
        user: { id: 'user-1', email: 'demo@example.com', name: 'Demo User' },
      });
      return { ...payload };
    });
    (useLoginTwoFactor as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    renderWithProviders(<TwoFactorScreen />);

    fireEvent.changeText(screen.getByTestId('twofactor-code'), '123456');
    fireEvent.press(screen.getByTestId('twofactor-submit'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ challengeToken: 'challenge-123', code: '123456' }));
    expect(useAuthStore.getState().accessToken).toBe('access-2fa');
  });

  it('shows an error banner on invalid codes', async () => {
    const axiosError = new AxiosError(
      'invalid',
      undefined,
      undefined,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {} as Record<string, string>,
        config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
        data: { message: 'Invalid or expired code' },
      }
    );
    (useLoginTwoFactor as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(axiosError),
      isPending: false,
    });

    renderWithProviders(<TwoFactorScreen />);

    fireEvent.changeText(screen.getByTestId('twofactor-code'), '000000');
    fireEvent.press(screen.getByTestId('twofactor-submit'));

    expect(await screen.findByText(/Invalid or expired code/i)).toBeTruthy();
  });
});
