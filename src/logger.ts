import { inject, singleton } from 'tsyringe';

import { FastifyBaseLogger } from 'fastify';

import { FASTIFY_LOGGER_DI_KEY } from './di/constants';

@singleton()
export class BaseLogger implements FastifyBaseLogger {
  level: FastifyBaseLogger['level'];
  msgPrefix: FastifyBaseLogger['msgPrefix'];
  child: FastifyBaseLogger['child'];
  fatal: FastifyBaseLogger['fatal'];
  warn: FastifyBaseLogger['warn'];
  debug: FastifyBaseLogger['debug'];
  trace: FastifyBaseLogger['trace'];
  silent: FastifyBaseLogger['silent'];
  info: FastifyBaseLogger['info'];
  error: FastifyBaseLogger['error'];

  constructor(@inject(FASTIFY_LOGGER_DI_KEY) private logger: FastifyBaseLogger) {
    this.level = logger.level;
    this.msgPrefix = logger.msgPrefix;
    this.child = logger.child.bind(logger);
    this.fatal = logger.fatal.bind(logger);
    this.warn = logger.warn.bind(logger);
    this.debug = logger.debug.bind(logger);
    this.trace = logger.trace.bind(logger);
    this.silent = logger.silent.bind(logger);
    this.info = logger.info.bind(logger);
    this.error = logger.error.bind(logger);
  }
}
