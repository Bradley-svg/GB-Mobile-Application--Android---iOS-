import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { VendorDisabledBanner } from '../components/VendorDisabledBanner';

const baseFlags = { disabled: [], prodLike: false };

describe('VendorDisabledBanner', () => {
  it('renders summary for multiple disabled flags', () => {
    render(
      <VendorDisabledBanner
        isDemoOrg
        vendorFlags={{ ...baseFlags, mqttDisabled: true, controlDisabled: true }}
      />
    );

    expect(screen.getByTestId('vendor-disabled-banner')).toBeTruthy();
    expect(screen.getByText(/Demo environment: MQTT \+ Control disabled\./i)).toBeTruthy();
  });

  it('renders history-only summary', () => {
    render(
      <VendorDisabledBanner
        isDemoOrg
        vendorFlags={{ ...baseFlags, heatPumpHistoryDisabled: true }}
      />
    );

    expect(screen.getByText(/Demo environment: History disabled\./i)).toBeTruthy();
  });

  it('hides banner for non-demo tenants', () => {
    render(
      <VendorDisabledBanner
        isDemoOrg={false}
        vendorFlags={{ ...baseFlags, pushDisabled: true }}
      />
    );

    expect(screen.queryByTestId('vendor-disabled-banner')).toBeNull();
  });
});
