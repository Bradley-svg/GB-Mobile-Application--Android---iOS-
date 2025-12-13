/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Small helper used by scripts/check-vendor-history.js and unit tests.
 * Computes compact stats for vendor history series without any TypeScript deps.
 */

function isNumericValue(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function summarizeSingleSeries(entry, sampleSize = 3) {
  const summary = {
    field: entry.field,
    pointsCount: 0,
    nonZeroCount: 0,
    min: null,
    max: null,
    firstTimestamp: null,
    lastTimestamp: null,
    sample: [],
  };

  entry.points.forEach((point, idx) => {
    summary.pointsCount += 1;
    const ts = new Date(point.timestamp);
    if (!Number.isNaN(ts.getTime())) {
      if (!summary.firstTimestamp || ts < new Date(summary.firstTimestamp)) {
        summary.firstTimestamp = ts.toISOString();
      }
      if (!summary.lastTimestamp || ts > new Date(summary.lastTimestamp)) {
        summary.lastTimestamp = ts.toISOString();
      }
    }

    if (idx < sampleSize) {
      summary.sample.push({
        timestamp: point.timestamp,
        value: point.value ?? null,
      });
    }

    if (!isNumericValue(point.value)) return;

    if (point.value !== 0) summary.nonZeroCount += 1;
    if (summary.min === null || point.value < summary.min) summary.min = point.value;
    if (summary.max === null || point.value > summary.max) summary.max = point.value;
  });

  return summary;
}

function summarizeSeriesCollection(seriesList) {
  const byField = seriesList.map((entry) => summarizeSingleSeries(entry));
  const aggregate = byField.reduce(
    (acc, current) => {
      acc.pointsCount += current.pointsCount;
      acc.nonZeroCount += current.nonZeroCount;
      if (current.min !== null && (acc.min === null || current.min < acc.min)) {
        acc.min = current.min;
      }
      if (current.max !== null && (acc.max === null || current.max > acc.max)) {
        acc.max = current.max;
      }
      if (
        current.firstTimestamp &&
        (!acc.firstTimestamp || new Date(current.firstTimestamp) < new Date(acc.firstTimestamp))
      ) {
        acc.firstTimestamp = current.firstTimestamp;
      }
      if (
        current.lastTimestamp &&
        (!acc.lastTimestamp || new Date(current.lastTimestamp) > new Date(acc.lastTimestamp))
      ) {
        acc.lastTimestamp = current.lastTimestamp;
      }
      return acc;
    },
    {
      pointsCount: 0,
      nonZeroCount: 0,
      min: null,
      max: null,
      firstTimestamp: null,
      lastTimestamp: null,
    }
  );

  return { aggregate, byField };
}

function findFirstNonZeroField(byField, preferredOrder = []) {
  const order =
    preferredOrder.length > 0 ? preferredOrder : byField.map((entry) => entry.field);
  const index = new Map(byField.map((entry) => [entry.field, entry]));

  for (const field of order) {
    const summary = index.get(field);
    if (summary && summary.nonZeroCount > 0) {
      return summary;
    }
  }

  return byField.find((entry) => entry.nonZeroCount > 0) || null;
}

module.exports = {
  findFirstNonZeroField,
  summarizeSeriesCollection,
  summarizeSingleSeries,
};
