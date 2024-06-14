import { Redis } from 'ioredis';
import { InjectionToken, container } from 'tsyringe';

import { FastifyInstance } from 'fastify';

import { CRON_3AM_MONDAY, JobServiceBuilder } from './jobs';
import { BaseLogger } from './logger';
import { MailerService } from './plugins/mailer/service';
import FileService from './services/file/service';
import { fileRepositoryFactory } from './services/file/utils/factory';
import FileItemService from './services/item/plugins/file/service';
import { H5PService } from './services/item/plugins/html/h5p/service';
import { ImportExportService } from './services/item/plugins/importExport/service';
import { createMeiliSearchWrapper } from './services/item/plugins/published/plugins/search/factory';
import { MeiliSearchWrapper } from './services/item/plugins/published/plugins/search/meilisearch';
import { SearchService } from './services/item/plugins/published/plugins/search/service';
import { ItemService } from './services/item/service';
import {
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
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
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from './utils/config';
import {
  FASTIFY_LOGGER_DI_KEY,
  FILE_ITEM_TYPE_DI_KEY,
  FILE_REPOSITORY_DI_KEY,
} from './utils/dependencies.keys';

export const resolveDependency = <T>(injectionToken: InjectionToken<T> | string) => {
  return container.resolve<T>(injectionToken);
};

/**
 * Clear all previously created and registered instances.
 * This is very usefull in the tests to ensure to have new Singleton instance in every test.
 */
export const resetDependencies = () => {
  container.clearInstances();
};

export const registerValue = <T>(injectionToken: InjectionToken<T> | string, value: T) => {
  container.register(injectionToken, { useValue: value });
};

export const registerDependencies = (instance: FastifyInstance) => {
  const { log, db } = instance;

  // register FastifyBasLogger as a value to allow BaseLogger to be injected automatically.
  container.register(FASTIFY_LOGGER_DI_KEY, { useValue: log });

  // register file type for the StorageService.
  container.register(FILE_ITEM_TYPE_DI_KEY, { useValue: FILE_ITEM_TYPE });

  container.register(Redis, {
    useValue: new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      username: REDIS_USERNAME,
      password: REDIS_PASSWORD,
    }),
  });

  container.register(MailerService, {
    useValue: new MailerService({
      host: MAILER_CONFIG_SMTP_HOST,
      port: MAILER_CONFIG_SMTP_PORT,
      useSsl: MAILER_CONFIG_SMTP_USE_SSL,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    }),
  });

  container.register(FILE_REPOSITORY_DI_KEY, {
    useValue: fileRepositoryFactory(FILE_ITEM_TYPE, {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    }),
  });

  container.register(MeiliSearchWrapper, {
    useValue: createMeiliSearchWrapper(
      resolveDependency(FileService),
      db,
      resolveDependency(BaseLogger),
    ),
  });

  container.register(ImportExportService, {
    useValue: new ImportExportService(
      db,
      resolveDependency(FileItemService),
      resolveDependency(ItemService),
      resolveDependency(H5PService),
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
