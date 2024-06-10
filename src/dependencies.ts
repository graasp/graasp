import { Redis } from 'ioredis';
import { InjectionToken, container, instanceCachingFactory } from 'tsyringe';

import { FastifyInstance } from 'fastify';

import FileService from './services/file/service';
import { fileServiceFactory } from './services/file/utils/factory';
import { ItemPublishedService } from './services/item/plugins/published/service';
import { ImageClassifierApiEnv } from './services/item/plugins/validation/ImageClassifierApi';
import { ItemValidationService } from './services/item/plugins/validation/service';
import { ItemService } from './services/item/service';
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from './utils/config';
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
  const { mailer, log } = instance;

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

  container.register(FileService, {
    useFactory: instanceCachingFactory(() => fileServiceFactory(instance.log)),
  });

  container.register(ItemValidationService, {
    useFactory: instanceCachingFactory(
      () =>
        new ItemValidationService(
          resolveDependency(ItemService),
          resolveDependency(FileService),
          resolveDependency(ImageClassifierApiEnv),
        ),
    ),
  });

  container.register(ItemPublishedService, {
    useFactory: instanceCachingFactory(
      () => new ItemPublishedService(resolveDependency(ItemService), mailer, log),
    ),
  });
};
