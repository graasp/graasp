import { Redis } from 'ioredis';
import { InjectionToken, container, instanceCachingFactory } from 'tsyringe';

import { FastifyInstance } from 'fastify';

import { CRON_3AM_MONDAY, JobServiceBuilder } from './jobs';
import { BaseLogger } from './logger';
import { MailerService } from './plugins/mailer/service';
import FileService from './services/file/service';
import { fileServiceFactory } from './services/file/utils/factory';
import { createMeiliSearchWrapper } from './services/item/plugins/published/plugins/search/factory';
import { MeiliSearchWrapper } from './services/item/plugins/published/plugins/search/meilisearch';
import { SearchService } from './services/item/plugins/published/plugins/search/service';
import {
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_SMTP_PORT,
  MAILER_CONFIG_SMTP_USE_SSL,
  MAILER_CONFIG_USERNAME,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from './utils/config';
import { FASTIFY_LOGGER_DI_KEY } from './utils/dependencies.keys';

export const resolveDependency = <T>(injectionToken: InjectionToken<T>) => {
  return container.resolve(injectionToken);
};

/**
 * Clear all previously created and registered instances.
 * This is very usefull in the tests to ensure to have new Singleton instance in every test.
 */
export const resetDependencies = () => {
  container.clearInstances();
};

// TODO: to be cleaned up.
// temporary step by manually register dependencies.
// this allow to test DI framework without having to annotate all the services (second step).
export const registerDependencies = (instance: FastifyInstance) => {
  const { log, db } = instance;

  // register FastifyBasLogger as a value to allow BaseLogger to be injected automatically.
  container.register(FASTIFY_LOGGER_DI_KEY, { useValue: log });

  container.register(Redis, {
    useFactory: instanceCachingFactory(
      () =>
        new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          username: REDIS_USERNAME,
          password: REDIS_PASSWORD,
        }),
    ),
  });

  container.register(MailerService, {
    useFactory: instanceCachingFactory(
      () =>
        new MailerService({
          host: MAILER_CONFIG_SMTP_HOST,
          port: MAILER_CONFIG_SMTP_PORT,
          useSsl: MAILER_CONFIG_SMTP_USE_SSL,
          username: MAILER_CONFIG_USERNAME,
          password: MAILER_CONFIG_PASSWORD,
          fromEmail: MAILER_CONFIG_FROM_EMAIL,
        }),
    ),
  });

  container.register(FileService, {
    useFactory: instanceCachingFactory(() => fileServiceFactory(log)),
  });

  container.register(MeiliSearchWrapper, {
    useFactory: instanceCachingFactory(() =>
      createMeiliSearchWrapper(resolveDependency(FileService), db, resolveDependency(BaseLogger)),
    ),
  });

  // Launch Job workers
  const jobServiceBuilder = new JobServiceBuilder(resolveDependency(BaseLogger));
  jobServiceBuilder
    .registerTask('rebuild-index', {
      handler: () => resolveDependency(SearchService).rebuildIndex(),
      pattern: CRON_3AM_MONDAY,
    })
    .build();
};
