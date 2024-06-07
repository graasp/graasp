import type pino from 'pino';

import { FastifyBaseLogger } from 'fastify';
import type { ChildLoggerOptions } from 'fastify/types/logger';

export class BaseLogger implements FastifyBaseLogger {
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  child(bindings: pino.Bindings, options?: ChildLoggerOptions | undefined): FastifyBaseLogger {
    return this.logger.child(bindings, options);
  }

  level: pino.LevelWithSilentOrString;

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
