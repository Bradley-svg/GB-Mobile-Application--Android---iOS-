import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ForgotPasswordScreen } from '../screens/Auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/Auth/ResetPasswordScreen';
import { useRequestPasswordReset, useResetPassword } from '../api/hooks';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';
import { useNavigation, useRoute } from '@react-navigation/native';

jest.mock('../api/hooks', () => ({
  useRequestPasswordReset: jest.fn(),
  useResetPassword: jest.fn(),
}));

const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

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

describe('ForgotPasswordScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits a password reset request and shows confirmation', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({});
    (useRequestPasswordReset as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
      isError: false,
      reset: jest.fn(),
    });

    renderWithProviders(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByTestId('forgot-email-input'), 'user@example.com');
    fireEvent.press(screen.getByTestId('forgot-submit-button'));

    expect(mutateAsync).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(await screen.findByTestId('forgot-success')).toBeTruthy();
  });

  it('renders backend errors from the reset request', async () => {
    const axiosError = new AxiosError('fail', undefined, undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
      data: { message: 'Reset failed' },
    });
    (useRequestPasswordReset as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(axiosError),
      isPending: false,
      error: axiosError,
      isError: true,
      reset: jest.fn(),
    });

    renderWithProviders(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByTestId('forgot-email-input'), 'bad@example.com');
    fireEvent.press(screen.getByTestId('forgot-submit-button'));

    expect(await screen.findByTestId('forgot-backend-error')).toBeTruthy();
  });
});

describe('ResetPasswordScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates password mismatch locally', async () => {
    (useResetPassword as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
      isError: false,
      reset: jest.fn(),
    });

    renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(screen.getByTestId('reset-token-input'), 'token-123');
    fireEvent.changeText(screen.getByTestId('reset-password-input'), 'pass1');
    fireEvent.changeText(screen.getByTestId('reset-confirm-input'), 'pass2');
    fireEvent.press(screen.getByTestId('reset-submit-button'));

    expect(await screen.findByTestId('reset-local-error')).toBeTruthy();
  });

  it('navigates to login after a successful reset', async () => {
    const navigate = jest.fn();
    (useRoute as jest.Mock).mockReturnValue({ params: { token: 'prefilled-token' } });
    (useNavigation as jest.Mock).mockReturnValue({ navigate });
    const mutateAsync = jest.fn().mockResolvedValue({ ok: true });
    (useResetPassword as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
      isError: false,
      reset: jest.fn(),
    });

    renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(screen.getByTestId('reset-password-input'), 'newpass');
    fireEvent.changeText(screen.getByTestId('reset-confirm-input'), 'newpass');
    fireEvent.press(screen.getByTestId('reset-submit-button'));

    expect(mutateAsync).toHaveBeenCalledWith({ token: 'prefilled-token', password: 'newpass' });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('Login', {
        resetSuccessMessage: 'Password reset successful. You can log in with your new password.',
      })
    );
  });

  it('shows backend errors for invalid tokens', async () => {
    const axiosError = new AxiosError('invalid', undefined, undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} as Record<string, string> } as InternalAxiosRequestConfig,
      data: { message: 'Invalid or expired reset token' },
    });
    (useResetPassword as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(axiosError),
      isPending: false,
      error: axiosError,
      isError: true,
      reset: jest.fn(),
    });

    renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(screen.getByTestId('reset-token-input'), 'bad-token');
    fireEvent.changeText(screen.getByTestId('reset-password-input'), 'newpass');
    fireEvent.changeText(screen.getByTestId('reset-confirm-input'), 'newpass');
    fireEvent.press(screen.getByTestId('reset-submit-button'));

    expect(await screen.findByTestId('reset-backend-error')).toBeTruthy();
  });
});
