import pino from 'pino'

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LOG_FORMAT = process.env.LOG_FORMAT || 'json'

const transport =
  LOG_FORMAT === 'console'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined

export const logger = pino({
  level: LOG_LEVEL,
  transport,
})
