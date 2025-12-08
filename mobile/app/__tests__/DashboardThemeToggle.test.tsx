import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { AppThemeProvider } from '../theme/ThemeProvider';
import { useAppTheme } from '../theme/useAppTheme';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    useColorScheme: jest.fn(() => 'light'),
  };
});

jest.mock('../api/hooks', () => ({
  useSites: jest.fn(() => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() })),
  useAlerts: jest.fn(() => ({ data: [], isLoading: false, isError: false })),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(() => ({ isOffline: false })),
}));

jest.mock('../utils/storage', () => ({
  saveJson: jest.fn(),
  loadJsonWithMetadata: jest.fn().mockResolvedValue(null),
  isCacheOlderThan: jest.fn().mockReturnValue(false),
}));

const ModeProbe: React.FC = () => {
  const { mode } = useAppTheme();
  return <Text testID="mode-probe">{mode}</Text>;
};

describe('Dashboard theme toggle', () => {
  it('updates theme mode when toggled', async () => {
    const { findAllByTestId, getByTestId } = render(
      <AppThemeProvider>
        <ModeProbe />
        <DashboardScreen />
      </AppThemeProvider>
    );

    const darkToggle = (await findAllByTestId('pill-dark'))[0];
    fireEvent.press(darkToggle);
    expect(getByTestId('mode-probe').props.children).toBe('dark');

    const lightToggle = (await findAllByTestId('pill-light'))[0];
    fireEvent.press(lightToggle);
    expect(getByTestId('mode-probe').props.children).toBe('light');
  });
});
