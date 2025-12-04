import cors, { CorsOptions } from 'cors';
import { loadCorsConfig } from '../config/cors';

export function buildCorsOptions(): CorsOptions {
  const { allowedOrigins, allowAll } = loadCorsConfig();

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
