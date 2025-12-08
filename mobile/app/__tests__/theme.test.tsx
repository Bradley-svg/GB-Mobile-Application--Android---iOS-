import React from 'react';
import { Button, Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppThemeProvider, THEME_PREFERENCE_KEY } from '../theme/ThemeProvider';
import { useAppTheme } from '../theme/useAppTheme';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    useColorScheme: jest.fn(() => 'light'),
  };
});

const ThemeProbe: React.FC = () => {
  const { theme, mode, resolvedScheme, setMode } = useAppTheme();
  return (
    <>
      <Text testID="mode">{`${mode}-${resolvedScheme}`}</Text>
      <Text testID="background">{theme.colors.background}</Text>
      <Button title="set-dark" testID="set-dark" onPress={() => setMode('dark')} />
      <Button title="set-light" testID="set-light" onPress={() => setMode('light')} />
    </>
  );
};

describe('AppThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves system scheme by default', async () => {
    (require('react-native').useColorScheme as jest.Mock).mockReturnValue('dark');
    const { findByTestId } = render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    const mode = await findByTestId('mode');
    expect(mode.props.children).toBe('system-dark');
  });

  it('persists and applies selected mode', async () => {
    (require('react-native').useColorScheme as jest.Mock).mockReturnValue('light');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('light');

    const { findByTestId, getByTestId } = render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>
    );

    const modeEl = await findByTestId('mode');
    expect(modeEl.props.children).toBe('light-light');

    fireEvent.press(getByTestId('set-dark'));

    await waitFor(() => expect(getByTestId('mode').props.children).toBe('dark-dark'));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY, 'dark');
  });
});
