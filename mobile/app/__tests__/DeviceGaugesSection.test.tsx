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
    tank_temp: [{ ts: '2025-01-01T10:00:00Z', value: 45 }],
    dhw_temp: [{ ts: '2025-01-01T10:00:00Z', value: 38 }],
    ambient_temp: [{ ts: '2025-01-01T10:00:00Z', value: 22 }],
    flow_rate: [{ ts: '2025-01-01T10:00:00Z', value: 12 }],
    power_kw: [{ ts: '2025-01-01T10:00:00Z', value: 5 }],
    cop: [{ ts: '2025-01-01T10:00:00Z', value: 3.2 }],
  },
};

describe('DeviceGaugesSection', () => {
  it('renders grouped gauges when telemetry is present', () => {
    renderWithTheme(
      <DeviceGaugesSection telemetry={baseTelemetry} isOffline={false} compressorCurrent={22} />
    );

    expect(screen.getByText(/Status gauges/i)).toBeTruthy();
    expect(screen.getByText(/Temperatures/i)).toBeTruthy();
    expect(screen.getByText(/Tank temperature/i)).toBeTruthy();
    expect(screen.getByText(/DHW temperature/i)).toBeTruthy();
    expect(screen.getByText(/Ambient temperature/i)).toBeTruthy();
    expect(screen.getByText(/Power draw/i)).toBeTruthy();
    expect(screen.getByText(/COP/i)).toBeTruthy();
    expect(screen.getByText(/22.0 A/)).toBeTruthy();
  });

  it('renders per-gauge empty messaging when metrics are missing', () => {
    const telemetryWithoutFlow: DeviceTelemetry = {
      ...baseTelemetry,
      metrics: { ...baseTelemetry.metrics, ambient_temp: [] },
    };

    renderWithTheme(
      <DeviceGaugesSection
        telemetry={telemetryWithoutFlow}
        isOffline={false}
        compressorCurrent={null}
      />
    );

    expect(screen.getByTestId('gauge-ambient-temp-empty')).toBeTruthy();
    expect(screen.getAllByText(/No recent data/i).length).toBeGreaterThan(0);
  });

  it('shows an empty state when telemetry is missing', () => {
    renderWithTheme(<DeviceGaugesSection telemetry={null} isOffline={false} />);

    expect(screen.getByTestId('device-gauges-empty')).toBeTruthy();
    expect(screen.getByText(/No telemetry available yet/i)).toBeTruthy();
  });
});
