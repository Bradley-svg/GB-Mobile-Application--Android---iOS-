import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CompressorHistoryCard } from '../screens/Device/CompressorHistoryCard';
import type { HeatPumpMetric, TimeRange } from '../api/types';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';

jest.mock('victory-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { View } = require('react-native');

  const VictoryChart = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  const VictoryLine = ({ style }: { style?: Record<string, unknown> }) =>
    React.createElement(View, { testID: 'victory-line', style });
  const VictoryArea = ({ style }: { style?: Record<string, unknown> }) =>
    React.createElement(View, { testID: 'victory-area', style });
  const VictoryAxis = ({ style }: { style?: Record<string, unknown> }) =>
    React.createElement(View, { testID: 'victory-axis', style });
  const VictoryLegend = ({ style }: { style?: Record<string, unknown> }) =>
    React.createElement(View, { testID: 'victory-legend', style });

  return {
    VictoryChart,
    VictoryLine,
    VictoryArea,
    VictoryAxis,
    VictoryLegend,
  };
});

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

const metricOptions = [
  {
    key: 'compressor_current' as HeatPumpMetric,
    label: 'Compressor current',
    unit: 'A',
    decimals: 1,
    color: lightTheme.colors.chartPrimary,
  },
  {
    key: 'cop' as HeatPumpMetric,
    label: 'COP',
    unit: '',
    decimals: 2,
    color: lightTheme.colors.chartSecondary,
  },
];

const baseProps = {
  metric: 'compressor_current' as HeatPumpMetric,
  metricOptions,
  status: 'ok' as const,
  isLoading: false,
  range: '24h' as TimeRange,
  onRangeChange: jest.fn(),
  onMetricChange: jest.fn(),
  onRetry: jest.fn(),
  points: [],
  errorMessage: 'Failed',
};

describe('CompressorHistoryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    renderWithTheme(
      <CompressorHistoryCard {...baseProps} status="ok" isLoading errorMessage="Loading" />
    );

    expect(screen.getByTestId('compressor-history-loading')).toBeTruthy();
  });

  it('renders chart when data is present', () => {
    renderWithTheme(
      <CompressorHistoryCard
        {...baseProps}
        points={[{ x: new Date('2025-01-01T12:00:00Z'), y: 12 }]}
      />
    );

    expect(screen.getByTestId('heatPumpHistoryChart')).toBeTruthy();
    expect(screen.getByTestId('victory-line').props.style.data.stroke).toBe(
      lightTheme.colors.chartPrimary
    );
  });

  it('renders empty state when no data is returned', () => {
    renderWithTheme(<CompressorHistoryCard {...baseProps} status="noData" />);

    expect(screen.getByText(/No history for this metric in the selected range/i)).toBeTruthy();
  });

  it('nudges to expand range when 1h is empty', () => {
    renderWithTheme(<CompressorHistoryCard {...baseProps} status="noData" range="1h" />);

    expect(screen.getByText(/Waiting for live data/i)).toBeTruthy();
    expect(screen.getByText(/last 6h range/i)).toBeTruthy();
  });

  it('renders error state for backend or offline failures', () => {
    renderWithTheme(
      <CompressorHistoryCard {...baseProps} status="offline" errorMessage="Offline error" />
    );

    expect(screen.getByTestId('compressor-history-error')).toBeTruthy();
    expect(screen.getByText(/Offline error/i)).toBeTruthy();
  });

  it('allows changing ranges', () => {
    const onRangeChange = jest.fn();
    renderWithTheme(
      <CompressorHistoryCard {...baseProps} status="ok" onRangeChange={onRangeChange} />
    );

    fireEvent.press(screen.getByTestId('pill-7d'));
    expect(onRangeChange).toHaveBeenCalledWith('7d');
  });

  it('renders vendor caption when provided', () => {
    renderWithTheme(
      <CompressorHistoryCard
        {...baseProps}
        vendorCaption="Live vendor history: Compressor current via /heat-pump-history"
      />
    );

    expect(screen.getByText(/Live vendor history: Compressor current/i)).toBeTruthy();
  });

  it('updates legend when metric changes', () => {
    const onMetricChange = jest.fn();
    renderWithTheme(
      <CompressorHistoryCard
        {...baseProps}
        points={[{ x: new Date('2025-01-01T12:00:00Z'), y: 6.2 }]}
        onMetricChange={onMetricChange}
      />
    );

    expect(screen.getByText(/Compressor current.*6.2 A/i)).toBeTruthy();
    fireEvent.press(screen.getByTestId('pill-cop'));
    expect(onMetricChange).toHaveBeenCalledWith('cop');
  });
});
