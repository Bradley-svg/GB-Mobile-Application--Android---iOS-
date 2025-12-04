type LogLevel = 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, component: string, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${component}] [${level.toUpperCase()}] ${message}`;
  if (meta === undefined || meta === null) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return `${base} ${String(meta)}`;
  }
}

function log(level: LogLevel, component: string, message: string, meta?: unknown) {
  const line = formatMessage(level, component, message, meta);
  if (level === 'info') {
    console.log(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.error(line);
  }
}

export const logger = {
  info: (component: string, message: string, meta?: unknown) =>
    log('info', component, message, meta),
  warn: (component: string, message: string, meta?: unknown) =>
    log('warn', component, message, meta),
  error: (component: string, message: string, meta?: unknown) =>
    log('error', component, message, meta),
};
