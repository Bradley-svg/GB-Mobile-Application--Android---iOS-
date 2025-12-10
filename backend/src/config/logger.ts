import pino from 'pino';
import { getRequestContext } from './requestContext';

const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  base: {
    service: 'greenbro-backend',
    env: nodeEnv,
  },
  mixin() {
    const context = getRequestContext();
    return context?.requestId ? { requestId: context.requestId } : {};
  },
});
