import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { SharingScreen } from '../screens/Profile/SharingScreen';
import { useSites, useDevices } from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import { useAuthStore } from '../store/authStore';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

jest.mock('../api/hooks', () => ({
  useSites: jest.fn(),
  useDevices: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('SharingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useSites as jest.Mock).mockReturnValue({
      data: [{ id: 'site-1', name: 'Site One', city: 'Cape Town', device_count: 2 }],
      isLoading: false,
    });
    (useDevices as jest.Mock).mockReturnValue({
      data: [
        { id: 'device-1', name: 'Pump', type: 'heat_pump', status: 'online', health: 'healthy' },
      ],
      isLoading: false,
    });
  });

  it('allows owners to navigate to share links', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'owner' },
    });
    const navigate = jest.fn();
    const navigationMock: Partial<NavigationProp<AppStackParamList>> = { navigate };
    jest
      .spyOn(navigation, 'useNavigation')
      .mockReturnValue(navigationMock as NavigationProp<AppStackParamList>);
    const route: RouteProp<AppStackParamList, 'Sharing'> = {
      key: 'Sharing',
      name: 'Sharing',
      params: undefined,
    };
    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);

    render(<SharingScreen />);

    fireEvent.press(screen.getByTestId('manage-site-share'));
    expect(navigate).toHaveBeenCalledWith('ShareLinks', {
      scope: 'site',
      id: 'site-1',
      name: 'Site One',
    });
  });

  it('shows unavailable state for contractors', () => {
    useAuthStore.setState({
      user: {
        id: 'user-2',
        email: 'contractor@example.com',
        name: 'Contractor',
        role: 'contractor',
      },
    });
    const route: RouteProp<AppStackParamList, 'Sharing'> = {
      key: 'Sharing',
      name: 'Sharing',
      params: undefined,
    };
    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);
    const navigationMock: Partial<NavigationProp<AppStackParamList>> = {};
    jest
      .spyOn(navigation, 'useNavigation')
      .mockReturnValue(navigationMock as NavigationProp<AppStackParamList>);

    const { getByText, queryByTestId } = render(<SharingScreen />);

    expect(getByText(/Sharing unavailable/i)).toBeTruthy();
    expect(queryByTestId('manage-site-share')).toBeNull();
  });
});
