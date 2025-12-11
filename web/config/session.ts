const DEFAULT_IDLE_MINUTES = 30;
const DEFAULT_ABSOLUTE_HOURS = 8;

function parseDuration(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const SESSION_IDLE_MINUTES = parseDuration(
  process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES,
  DEFAULT_IDLE_MINUTES,
);

export const SESSION_ABSOLUTE_HOURS = parseDuration(
  process.env.NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS,
  DEFAULT_ABSOLUTE_HOURS,
);

export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_MINUTES * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;
