import React from 'react';
import { render } from '@testing-library/react-native';
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

  it('renders StatusPill and PrimaryButton in light mode', () => {
    const tree = render(
      <AppThemeProvider>
        <StatusPill label="Online" tone="success" />
        <PrimaryButton label="Action" />
      </AppThemeProvider>
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('renders StatusPill and PrimaryButton in dark mode', () => {
    setScheme('dark');
    const tree = render(
      <AppThemeProvider>
        <StatusPill label="Online" tone="success" />
        <PrimaryButton label="Action" />
      </AppThemeProvider>
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });
});
