import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { useLogin } from '../api/hooks';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';

jest.mock('../api/hooks', () => ({
  useLogin: jest.fn(),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

describe('LoginScreen error handling', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('shows invalid credential errors', async () => {
    const axiosError = new AxiosError('unauthorized', undefined, undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
      data: { message: 'Invalid email or password' },
    });
    (useLogin as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(axiosError),
      isPending: false,
      error: null,
      isError: false,
    });

    renderWithProviders(<LoginScreen />);

    fireEvent.press(screen.getByTestId('login-button'));

    expect(await screen.findByText(/Invalid email or password/i)).toBeTruthy();
  });

  it('shows rate limit / lockout messaging', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-01T00:00:00Z').getTime());
    const axiosError = new AxiosError('locked', undefined, undefined, undefined, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'retry-after': '300' },
      config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
      data: { message: 'Too many failed attempts', lockedUntil: '2025-01-01T00:05:00Z' },
    });
    (useLogin as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(axiosError),
      isPending: false,
      error: null,
      isError: false,
    });

    renderWithProviders(<LoginScreen />);

    fireEvent.press(screen.getByTestId('login-button'));

    expect(await screen.findByText(/Too many failed attempts/i)).toBeTruthy();
    expect(screen.getByText(/5 minute/)).toBeTruthy();
  });
});
