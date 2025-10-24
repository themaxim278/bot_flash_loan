import pino from 'pino';

// Global structured logger
// Default level: info. Override via LOG_LEVEL env.
const level = (process.env.LOG_LEVEL || 'info').toLowerCase();

export const logger = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;