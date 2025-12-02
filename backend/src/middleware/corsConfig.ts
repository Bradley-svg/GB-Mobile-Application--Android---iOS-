import cors, { CorsOptions } from 'cors';

function parseAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildCorsOptions(): CorsOptions {
  const env = process.env.NODE_ENV || 'development';
  const allowedOrigins = parseAllowedOrigins();
  const allowAll = env !== 'production' && allowedOrigins.length === 0;

  if (env === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be set in production');
  }

  return {
    origin: (origin, callback) => {
      if (!origin) {
        // Allow mobile clients and curl/health checks that send no Origin header.
        return callback(null, true);
      }

      const isAllowed = allowAll || allowedOrigins.includes(origin);
      return callback(null, isAllowed);
    },
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200,
  };
}

export function createCorsMiddleware() {
  const corsOptions = buildCorsOptions();
  return cors(corsOptions);
}
