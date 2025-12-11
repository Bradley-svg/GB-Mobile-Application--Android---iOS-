import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { AppThemeProvider } from '../theme/ThemeProvider';
import { StatusPill } from '../components/StatusPill';
import { PrimaryButton } from '../components/PrimaryButton';

const setScheme = (scheme: 'light' | 'dark') => {
  (useColorScheme as jest.Mock).mockReturnValue(scheme);
};

describe('Themed components', () => {
  beforeEach(() => {
    setScheme('light');
  });

  it('renders StatusPill and PrimaryButton in light mode', async () => {
    const { getByText, toJSON } = render(
      <AppThemeProvider>
        <StatusPill label="Online" tone="success" />
        <PrimaryButton label="Action" />
      </AppThemeProvider>
    );

    await waitFor(() => expect(getByText('Online')).toBeTruthy());
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders StatusPill and PrimaryButton in dark mode', async () => {
    setScheme('dark');
    const { getByText, toJSON } = render(
      <AppThemeProvider>
        <StatusPill label="Online" tone="success" />
        <PrimaryButton label="Action" />
      </AppThemeProvider>
    );

    await waitFor(() => expect(getByText('Online')).toBeTruthy());
    expect(toJSON()).toMatchSnapshot();
  });
});
