import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as navigation from '@react-navigation/native';
import { DocumentsScreen } from '../screens/Documents/DocumentsScreen';
import {
  useSiteDocuments,
  useDeviceDocuments,
} from '../api/hooks';
import { useNetworkBanner } from '../hooks/useNetworkBanner';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));
jest.mock('../api/hooks', () => ({
  useSiteDocuments: jest.fn(),
  useDeviceDocuments: jest.fn(),
}));
jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: jest.fn(),
}));

describe('DocumentsScreen', () => {
  beforeEach(() => {
    (navigation.useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
    });
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { scope: 'site', siteId: 'site-1' },
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: false });
    (useSiteDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      dataUpdatedAt: 0,
    });
    (useDeviceDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      dataUpdatedAt: 0,
    });
  });

  it('renders documents list for a site', () => {
    (useSiteDocuments as jest.Mock).mockReturnValue({
      data: [{ id: 'doc-1', title: 'Manual', category: 'manual', url: '/files/doc.pdf' }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<DocumentsScreen />);

    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getByTestId('document-row')).toBeTruthy();
  });

  it('shows cached banner when offline with data', () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { scope: 'site', siteId: 'site-1' },
    });
    (useNetworkBanner as jest.Mock).mockReturnValue({ isOffline: true });
    (useSiteDocuments as jest.Mock).mockReturnValue({
      data: [{ id: 'doc-2', title: 'Schematic', category: 'schematic', url: '/files/doc.png' }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      dataUpdatedAt: Date.now(),
    });

    render(<DocumentsScreen />);

    expect(screen.getByTestId('documents-offline-banner')).toBeTruthy();
  });

  it('renders error state when fetch fails', () => {
    (navigation.useRoute as jest.Mock).mockReturnValue({
      params: { scope: 'device', deviceId: 'dev-1' },
    });
    (useDeviceDocuments as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
      dataUpdatedAt: null,
    });

    render(<DocumentsScreen />);

    expect(screen.getByTestId('documents-error')).toBeTruthy();
  });
});
