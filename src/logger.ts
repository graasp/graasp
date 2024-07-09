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

  fatal(message: string, ...args: unknown[]) {
    this.logger.fatal(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(message, ...args);
  }

  trace(message: string, ...args: unknown[]) {
    this.logger.trace(message, ...args);
  }

  silent(message: string, ...args: unknown[]) {
    this.logger.silent(message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(message, ...args);
  }
}
