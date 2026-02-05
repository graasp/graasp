import { Bindings, LevelWithSilentOrString } from 'pino';
import { inject, singleton } from 'tsyringe';

import { type FastifyBaseLogger } from 'fastify';
import type { ChildLoggerOptions } from 'fastify/types/logger';

import { FASTIFY_LOGGER_DI_KEY } from './di/constants';

@singleton()
export class BaseLogger implements FastifyBaseLogger {
  level: LevelWithSilentOrString;

  constructor(
    @inject(FASTIFY_LOGGER_DI_KEY) private logger: FastifyBaseLogger,
  ) {
    this.level = logger.level;
  }

  child(
    bindings: Bindings,
    options?: ChildLoggerOptions | undefined,
  ): FastifyBaseLogger {
    return this.logger.child(bindings, options);
  }

  fatal(message: unknown) {
    if (typeof message === 'string') {
      this.logger.fatal(message);
    } else {
      console.error(message);
    }
  }

  warn(message: unknown) {
    if (typeof message === 'string') {
      this.logger.warn(message);
    } else {
      console.error(message);
    }
  }

  debug(message: unknown) {
    if (typeof message === 'string') {
      this.logger.debug(message);
    } else {
      console.error(message);
    }
  }

  trace(message: unknown) {
    if (typeof message === 'string') {
      this.logger.trace(message);
    } else {
      console.error(message);
    }
  }

  silent(message: unknown) {
    if (typeof message === 'string') {
      this.logger.silent(message);
    } else {
      console.error(message);
    }
  }

  info(message: unknown) {
    if (typeof message === 'string') {
      this.logger.info(message);
    } else {
      console.error(message);
    }
  }

  error(message: unknown) {
    if (typeof message === 'string') {
      this.logger.error(message);
    } else {
      console.error(message);
    }
  }
}
