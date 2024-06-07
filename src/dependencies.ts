import { InjectionToken, container, instanceCachingFactory } from 'tsyringe';

import { FastifyInstance } from 'fastify';

import FileService from './services/file/service';
import { fileServiceFactory } from './services/file/utils/factory';
import { ItemPublishedService } from './services/item/plugins/published/service';
import { ImageClassifierApiEnv } from './services/item/plugins/validation/ImageClassifierApi';
import { ItemValidationService } from './services/item/plugins/validation/service';

export const resolveDependency = <T>(injectionToken: InjectionToken<T>) => {
  return container.resolve(injectionToken);
};

export const registerFileService = (instance: FastifyInstance) => {
  container.register(FileService, {
    useFactory: instanceCachingFactory(() => fileServiceFactory(instance.log)),
  });
};

// TODO: to be cleaned up.
// temporary step by manually register dependencies.
// this allow to test DI framework without having to annotate all the services (second step).
export const registerDependencies = (instance: FastifyInstance) => {
  const {
    items: { service: itemService },
    mailer,
    log,
  } = instance;

  container.register(ItemValidationService, {
    useFactory: instanceCachingFactory(
      () =>
        new ItemValidationService(
          itemService,
          container.resolve(FileService),
          container.resolve(ImageClassifierApiEnv),
        ),
    ),
  });

  container.register(ItemPublishedService, {
    useFactory: instanceCachingFactory(() => new ItemPublishedService(itemService, mailer, log)),
  });
};
