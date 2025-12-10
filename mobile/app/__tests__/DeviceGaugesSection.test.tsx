import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { DeviceTelemetry } from '../api/types';
import { DeviceGaugesSection } from '../screens/Device/DeviceGaugesSection';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';

const renderWithTheme = (ui: React.ReactElement) =>
  render(
    <ThemeContext.Provider
      value={{
        theme: lightTheme,
        mode: 'light',
        resolvedScheme: 'light',
        setMode: jest.fn(),
        isReady: true,
      }}
    >
      {ui}
    </ThemeContext.Provider>
  );

const baseTelemetry: DeviceTelemetry = {
  range: '24h',
  metrics: {
    supply_temp: [{ ts: '2025-01-01T10:00:00Z', value: 45 }],
    return_temp: [{ ts: '2025-01-01T10:00:00Z', value: 38 }],
    flow_rate: [{ ts: '2025-01-01T10:00:00Z', value: 12 }],
    power_kw: [{ ts: '2025-01-01T10:00:00Z', value: 5 }],
    cop: [{ ts: '2025-01-01T10:00:00Z', value: 3.2 }],
  },
};

describe('DeviceGaugesSection', () => {
  it('renders gauges when telemetry is present', () => {
    renderWithTheme(
      <DeviceGaugesSection telemetry={baseTelemetry} isOffline={false} compressorCurrent={22} />
    );

    expect(screen.getByText(/Status gauges/i)).toBeTruthy();
    expect(screen.getByText(/Leaving water temp/i)).toBeTruthy();
    expect(screen.getByText(/Return water temp/i)).toBeTruthy();
    expect(screen.getByText(/Power draw/i)).toBeTruthy();
    expect(screen.getByText(/22.0 A/)).toBeTruthy();
  });

  it('renders "No data" indicators for missing metrics', () => {
    const telemetryWithoutFlow: DeviceTelemetry = {
      ...baseTelemetry,
      metrics: { ...baseTelemetry.metrics, flow_rate: [] },
    };

    renderWithTheme(
      <DeviceGaugesSection telemetry={telemetryWithoutFlow} isOffline={false} compressorCurrent={null} />
    );

    expect(screen.getAllByText(/No data/i).length).toBeGreaterThan(0);
  });

  it('shows an empty state when telemetry is missing', () => {
    renderWithTheme(<DeviceGaugesSection telemetry={null} isOffline={false} />);

    expect(screen.getByTestId('device-gauges-empty')).toBeTruthy();
    expect(screen.getByText(/No telemetry available yet/i)).toBeTruthy();
  });
});
