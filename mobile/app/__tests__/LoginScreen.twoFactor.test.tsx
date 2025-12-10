import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { useLogin } from '../api/hooks';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';
import { useAuthStore } from '../store/authStore';

jest.mock('../api/hooks', () => ({
  useLogin: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(),
    useRoute: jest.fn().mockReturnValue({ params: {} }),
  };
});

const renderWithProviders = (ui: React.ReactElement, navigate = jest.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const navigation = require('@react-navigation/native');
  (navigation.useNavigation as jest.Mock).mockReturnValue({ navigate });

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

describe('LoginScreen two-factor handling', () => {
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

  it('navigates to the two-factor screen when required', async () => {
    const navigate = jest.fn();
    (useLogin as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({
        requires2fa: true,
        challengeToken: 'challenge-123',
      }),
      isPending: false,
    });

    renderWithProviders(<LoginScreen />, navigate);

    fireEvent.press(screen.getByTestId('login-button'));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('TwoFactor', {
        challengeToken: 'challenge-123',
        email: 'demo@greenbro.com',
      })
    );
  });

  it('surfaces setup-required messaging for enforced roles', async () => {
    const navigate = jest.fn();
    (useLogin as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({
        twoFactorSetupRequired: true,
      }),
      isPending: false,
    });

    renderWithProviders(<LoginScreen />, navigate);

    fireEvent.press(screen.getByTestId('login-button'));

    expect(await screen.findByTestId('login-error-banner')).toBeTruthy();
    expect(screen.getByText(/Two-factor authentication is required/i)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('continues normal login flow when 2FA is not required', async () => {
    const navigate = jest.fn();
    (useLogin as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(async () => {
        await useAuthStore.getState().setAuth({
          accessToken: 'token-123',
          refreshToken: 'refresh-123',
          user: { id: 'user-1', email: 'demo@greenbro.com', name: 'Demo User' },
        });
        return { accessToken: 'token-123', refreshToken: 'refresh-123', user: { id: 'user-1' } };
      }),
      isPending: false,
    });

    renderWithProviders(<LoginScreen />, navigate);

    fireEvent.press(screen.getByTestId('login-button'));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-123'));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-error-banner')).toBeNull();
  });
});
