import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { SiteOverviewScreen } from '../screens/Site/SiteOverviewScreen';
import { useDevices, useSite } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

jest.mock('../api/hooks', () => ({
  useDevices: jest.fn(),
  useSite: jest.fn(),
}));
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('SiteOverview quick actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const route: RouteProp<AppStackParamList, 'SiteOverview'> = {
      key: 'SiteOverview',
      name: 'SiteOverview',
      params: { siteId: 'site-1' },
    };
    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useSite as jest.Mock).mockReturnValue({
      data: { id: 'site-1', name: 'Demo Site', city: 'CT', status: 'online', health: 'healthy' },
      isLoading: false,
      isError: false,
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: [
        { id: 'device-1', site_id: 'site-1', name: 'Pump', type: 'hp', status: 'online', health: 'healthy' },
      ],
      isLoading: false,
      isError: false,
    });
  });

  it('navigates to device detail from quick action', () => {
    const navigateSpy = jest.fn();
    jest
      .spyOn(navigation, 'useNavigation')
      .mockReturnValue({ navigate: navigateSpy } as unknown as NavigationProp<AppStackParamList>);

    render(<SiteOverviewScreen />);

    fireEvent.press(screen.getByTestId('device-action-detail'));
    expect(navigateSpy).toHaveBeenCalledWith('DeviceDetail', { deviceId: 'device-1' });
  });

  it('opens alerts tab from quick action', () => {
    const navigateSpy = jest.fn();
    jest
      .spyOn(navigation, 'useNavigation')
      .mockReturnValue({ navigate: navigateSpy } as unknown as NavigationProp<AppStackParamList>);

    render(<SiteOverviewScreen />);

    fireEvent.press(screen.getByTestId('device-action-alerts'));
    expect(navigateSpy).toHaveBeenCalledWith('Tabs', { screen: 'Alerts' });
  });

  it('shows connectivity pills for devices', () => {
    render(<SiteOverviewScreen />);

    const pill = screen.getByTestId('device-connectivity-pill');
    expect(within(pill).getByText(/Online/i)).toBeTruthy();
  });

  it('shows export button when online', () => {
    render(<SiteOverviewScreen />);
    expect(screen.getByTestId('export-devices-button')).toBeTruthy();
  });

  it('hides export button when offline', () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    render(<SiteOverviewScreen />);
    expect(screen.queryByTestId('export-devices-button')).toBeNull();
  });
});
