import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { AppThemeProvider } from '../theme/ThemeProvider';
import { ErrorCard } from '../components/ErrorCard';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    useColorScheme: jest.fn(() => 'light'),
  };
});

const setScheme = (scheme: 'light' | 'dark') => {
  (useColorScheme as jest.Mock).mockReturnValue(scheme);
};

const flattenStyle = (style: unknown) => {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style);
  }
  return (style as Record<string, unknown>) || {};
};

describe('ErrorCard theming', () => {
  it('uses distinct palettes for light and dark modes', async () => {
    setScheme('light');
    const { rerender } = render(
      <AppThemeProvider>
        <ErrorCard title="Failure" message="Details" testID="error-card" />
      </AppThemeProvider>
    );
    await waitFor(() => expect(screen.getByTestId('error-card')).toBeTruthy());

    const getBackground = () =>
      flattenStyle(screen.getByTestId('error-card').props.style).backgroundColor;
    const getTitleColor = () => flattenStyle(screen.getByText('Failure').props.style).color;

    const lightBg = getBackground();
    const lightTitle = getTitleColor();

    setScheme('dark');
    rerender(
      <AppThemeProvider>
        <ErrorCard title="Failure" message="Details" testID="error-card" />
      </AppThemeProvider>
    );
    await waitFor(() => expect(screen.getByTestId('error-card')).toBeTruthy());

    const darkBg = getBackground();
    const darkTitle = getTitleColor();

    expect(lightBg).not.toEqual(darkBg);
    expect(lightTitle).not.toEqual(lightBg);
    expect(darkTitle).not.toEqual(darkBg);
  });
});
