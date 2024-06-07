import { InjectionToken, container, instanceCachingFactory } from 'tsyringe';

import { FastifyInstance } from 'fastify';

import { BaseLogger } from './logger';
import FileService from './services/file/service';
import { fileServiceFactory } from './services/file/utils/factory';
import { ItemPublishedService } from './services/item/plugins/published/service';
import { ImageClassifierApiEnv } from './services/item/plugins/validation/ImageClassifierApi';
import { ItemValidationService } from './services/item/plugins/validation/service';
import { ItemService } from './services/item/service';

export const resolveDependency = <T>(injectionToken: InjectionToken<T>) => {
  return container.resolve(injectionToken);
};

// TODO: to be cleaned up.
// temporary step by manually register dependencies.
// this allow to test DI framework without having to annotate all the services (second step).
export const registerDependencies = (instance: FastifyInstance) => {
  const { mailer, log } = instance;

  container.register(FileService, {
    useFactory: instanceCachingFactory(() => fileServiceFactory(instance.log)),
  });

  container.register(BaseLogger, {
    useFactory: instanceCachingFactory(() => new BaseLogger(log)),
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
