"use client";

const DEFAULT_RETURN_TO = "/app";

const isUnsafeReturnTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return true;
  if (trimmed.startsWith("//")) return true;
  return false;
};

export function sanitizeReturnTo(raw: string | null | undefined, fallback = DEFAULT_RETURN_TO) {
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  if (isUnsafeReturnTarget(decoded)) return fallback;

  try {
    const url = new URL(decoded, "https://greenbro.local");
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    return isUnsafeReturnTarget(normalized) ? fallback : normalized;
  } catch {
    return fallback;
  }
}

export function appendReturnToParam(path: string, returnTo: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export { DEFAULT_RETURN_TO };
