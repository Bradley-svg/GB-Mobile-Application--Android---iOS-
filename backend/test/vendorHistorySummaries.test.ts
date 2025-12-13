import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  summarizeSeriesCollection,
  findFirstNonZeroField,
} = require('../scripts/vendorHistorySummaries');

describe('vendor history summarizer', () => {
  it('counts non-zero numeric values and min/max correctly', () => {
    const series = [
      {
        field: 'metric_compCurrentA',
        points: [
          { timestamp: '2025-01-01T00:00:00.000Z', value: 0 },
          { timestamp: '2025-01-01T00:05:00.000Z', value: 5 },
          { timestamp: '2025-01-01T00:10:00.000Z', value: -1 },
          { timestamp: 'invalid', value: Number.NaN },
          { timestamp: '2025-01-01T00:15:00.000Z', value: null },
        ],
      },
      {
        field: 'metric_powerW',
        points: [
          { timestamp: '2025-01-01T00:20:00.000Z', value: 0 },
          { timestamp: '2025-01-01T00:25:00.000Z', value: 12 },
          { timestamp: '2025-01-01T00:30:00.000Z', value: 'foo' },
        ],
      },
    ];

    const summary = summarizeSeriesCollection(series);

    expect(summary.aggregate).toMatchObject({
      pointsCount: 8,
      nonZeroCount: 3,
      min: -1,
      max: 12,
      firstTimestamp: '2025-01-01T00:00:00.000Z',
      lastTimestamp: '2025-01-01T00:30:00.000Z',
    });
    expect(summary.byField[0]).toMatchObject({
      field: 'metric_compCurrentA',
      pointsCount: 5,
      nonZeroCount: 2,
      min: -1,
      max: 5,
      firstTimestamp: '2025-01-01T00:00:00.000Z',
      lastTimestamp: '2025-01-01T00:15:00.000Z',
    });
    expect(summary.byField[1]).toMatchObject({
      field: 'metric_powerW',
      pointsCount: 3,
      nonZeroCount: 1,
      min: 0,
      max: 12,
      firstTimestamp: '2025-01-01T00:20:00.000Z',
      lastTimestamp: '2025-01-01T00:30:00.000Z',
    });
    expect(summary.byField[0].sample.length).toBeGreaterThan(0);
  });

  it('probe mode picks the first non-zero field in order', () => {
    const byField = [
      { field: 'metric_compCurrentA', pointsCount: 2, nonZeroCount: 0, min: null, max: null },
      { field: 'metric_compFreqHz', pointsCount: 2, nonZeroCount: 1, min: 10, max: 20 },
      { field: 'metric_powerW', pointsCount: 2, nonZeroCount: 2, min: 50, max: 60 },
    ];

    const hit = findFirstNonZeroField(byField, [
      'metric_compCurrentA',
      'metric_compFreqHz',
      'metric_powerW',
    ]);

    expect(hit?.field).toBe('metric_compFreqHz');
  });
});
