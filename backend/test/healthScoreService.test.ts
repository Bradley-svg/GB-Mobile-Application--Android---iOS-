import { describe, expect, it } from 'vitest';
import { computeHealthFromSignals, summarizeLastSeen } from '../src/services/healthScoreService';

describe('healthScoreService', () => {
  it('marks healthy when recent and no alerts', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = computeHealthFromSignals({
      status: 'online',
      lastSeenAt: new Date(now.getTime() - 2 * 60 * 1000),
      alerts: [],
      now,
    });

    expect(result.health).toBe('healthy');
    expect(result.lastSeen.isStale).toBe(false);
    expect(result.lastSeen.isOffline).toBe(false);
  });

  it('marks warning when last seen is stale', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = computeHealthFromSignals({
      status: 'online',
      lastSeenAt: new Date(now.getTime() - 20 * 60 * 1000),
      alerts: [],
      now,
    });

    expect(result.health).toBe('warning');
    expect(result.lastSeen.isStale).toBe(true);
  });

  it('marks offline when last seen exceeds offline threshold', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const lastSeen = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const summary = summarizeLastSeen(lastSeen, now, 10, 60);
    expect(summary.isOffline).toBe(true);

    const result = computeHealthFromSignals({
      status: 'online',
      lastSeenAt: lastSeen,
      alerts: [],
      now,
    });
    expect(result.health).toBe('offline');
  });

  it('elevates to critical when an active critical alert exists', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = computeHealthFromSignals({
      status: 'online',
      lastSeenAt: new Date(now.getTime() - 5 * 60 * 1000),
      alerts: ['critical'],
      now,
    });

    expect(result.health).toBe('critical');
    expect(result.dominantSeverity).toBe('critical');
  });
});
