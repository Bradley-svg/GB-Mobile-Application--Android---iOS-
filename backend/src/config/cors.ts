function parseAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadCorsConfig() {
  const env = process.env.NODE_ENV || 'development';
  const allowedOrigins = parseAllowedOrigins();
  const allowAll = env !== 'production' && allowedOrigins.length === 0;

  if (env === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be set in production');
  }

  return {
    env,
    allowedOrigins,
    allowAll,
  };
}
