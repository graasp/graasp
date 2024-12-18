import type { pino } from 'pino';
import { inject, singleton } from 'tsyringe';

import { FastifyBaseLogger } from 'fastify';
import type { ChildLoggerOptions } from 'fastify/types/logger';

import { FASTIFY_LOGGER_DI_KEY } from './di/constants';

@singleton()
export class BaseLogger implements FastifyBaseLogger {
  level: pino.LevelWithSilentOrString;

  constructor(@inject(FASTIFY_LOGGER_DI_KEY) private logger: FastifyBaseLogger) {
    this.level = logger.level;
  }

  child(bindings: pino.Bindings, options?: ChildLoggerOptions | undefined): FastifyBaseLogger {
    return this.logger.child(bindings, options);
  }

  fatal(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.fatal(message, ...args);
    } else {
      console.error(message);
    }
  }

  warn(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.warn(message, ...args);
    } else {
      console.error(message);
    }
  }

  debug(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.debug(message, ...args);
    } else {
      console.error(message);
    }
  }

  trace(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.trace(message, ...args);
    } else {
      console.error(message);
    }
  }

  silent(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.silent(message, ...args);
    } else {
      console.error(message);
    }
  }

  info(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.info(message, ...args);
    } else {
      console.error(message);
    }
  }

  error(message: unknown, ...args: unknown[]) {
    if (typeof message === 'string') {
      this.logger.error(message, ...args);
    } else {
      console.error(message);
    }
  }
}
