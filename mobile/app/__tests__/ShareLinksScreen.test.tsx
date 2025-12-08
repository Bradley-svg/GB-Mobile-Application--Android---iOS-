import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { ShareLinksScreen } from '../screens/Sharing/ShareLinksScreen';
import {
  useCreateShareLink,
  useRevokeShareLink,
  useShareLinks,
} from '../api/shareLinks/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/RootNavigator';

jest.mock('../api/shareLinks/hooks', () => ({
  useShareLinks: jest.fn(),
  useCreateShareLink: jest.fn(),
  useRevokeShareLink: jest.fn(),
}));

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('ShareLinksScreen', () => {
  const route: RouteProp<AppStackParamList, 'ShareLinks'> = {
    key: 'ShareLinks',
    name: 'ShareLinks',
    params: { scope: 'site', id: 'site-1', name: 'Site One' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useShareLinks as jest.Mock).mockReturnValue({ data: [], isLoading: false });
    (useCreateShareLink as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    (useRevokeShareLink as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
    jest.spyOn(navigation, 'useRoute').mockReturnValue(route);
    jest.spyOn(navigation, 'useNavigation').mockReturnValue({ goBack: jest.fn() } as any);
  });

  it('renders empty state when there are no links', () => {
    render(<ShareLinksScreen />);

    expect(screen.getByTestId('share-links-empty')).toBeTruthy();
  });

  it('renders share links', () => {
    (useShareLinks as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'link-1',
          scopeType: 'site',
          scopeId: 'site-1',
          token: 'token-abc',
          permissions: 'read_only',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    });

    render(<ShareLinksScreen />);

    expect(screen.getByTestId('share-link-row')).toBeTruthy();
  });

  it('disables create actions when offline', () => {
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });

    render(<ShareLinksScreen />);

    const buttons = screen.getAllByTestId('create-share-link');
    buttons.forEach((btn) => {
      expect(btn.props.disabled).toBe(true);
    });
  });
});
