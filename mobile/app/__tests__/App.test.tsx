import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../../App';

jest.mock('../hooks/useNetworkBanner', () => ({
  useNetworkBanner: () => ({ isOffline: false }),
}));

describe('App', () => {
  it('renders login flow when not authenticated', async () => {
    const { findByText } = render(<App />);
    const loginTitle = await findByText('Greenbro Login');
    expect(loginTitle).toBeTruthy();
  });
});
