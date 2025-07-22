import { Redis } from 'ioredis';
import { MeiliSearch } from 'meilisearch';

import type { FastifyBaseLogger } from 'fastify';

import Etherpad from '@graasp/etherpad-api';

import { MAILER_CONFIG_FROM_EMAIL, MAILER_CONNECTION, MAILER_USE_SSL } from '../config/mailer';
import { REDIS_CONNECTION } from '../config/redis';
import { BaseLogger } from '../logger';
import { MailerService } from '../plugins/mailer/mailer.service';
import { CachingService } from '../services/caching/service';
import FileService from '../services/file/file.service';
import { fileRepositoryFactory } from '../services/file/utils/factory';
import { wrapEtherpadErrors } from '../services/item/plugins/etherpad/etherpad';
import { RandomPadNameFactory } from '../services/item/plugins/etherpad/etherpad.service';
import { EtherpadServiceConfig } from '../services/item/plugins/etherpad/serviceConfig';
import {
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_STORAGE_TYPE,
  GEOLOCATION_API_KEY,
  IMAGE_CLASSIFIER_API,
  MEILISEARCH_MASTER_KEY,
  MEILISEARCH_URL,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from '../utils/config';
import {
  ETHERPAD_NAME_FACTORY_DI_KEY,
  FASTIFY_LOGGER_DI_KEY,
  FILE_SERVICE_URLS_CACHING_DI_KEY,
  FILE_STORAGE_TYPE_DI_KEY,
  GEOLOCATION_API_KEY_DI_KEY,
  IFRAMELY_API_DI_KEY,
  IMAGE_CLASSIFIER_API_DI_KEY,
} from './constants';
import { registerValue, resolveDependency } from './utils';

export const registerDependencies = (log: FastifyBaseLogger) => {
  // register FastifyBaseLogger as a value to allow BaseLogger to be injected automatically.
  registerValue(FASTIFY_LOGGER_DI_KEY, log);

  // register file storage type for the StorageService.
  registerValue(FILE_STORAGE_TYPE_DI_KEY, FILE_STORAGE_TYPE);

  // register classifier key for the ValidationService.
  registerValue(IMAGE_CLASSIFIER_API_DI_KEY, IMAGE_CLASSIFIER_API);

  // register iframely api host for the embeddedlink service.
  registerValue(IFRAMELY_API_DI_KEY, EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN);

  // register geolocation key for the ItemGeolocationService.
  registerValue(GEOLOCATION_API_KEY_DI_KEY, GEOLOCATION_API_KEY);

  registerValue(Redis, new Redis(REDIS_CONNECTION));

  // Register CachingService for the thumbnails urls.
  registerValue(
    FILE_SERVICE_URLS_CACHING_DI_KEY,
    new CachingService(resolveDependency(Redis), 'file_service_url_caching'),
  );
  // Register the FileService to inject the CacheService.
  const fileRepository = fileRepositoryFactory(FILE_STORAGE_TYPE, {
    s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
    local: FILE_ITEM_PLUGIN_OPTIONS,
  });
  registerValue(
    FileService,
    new FileService(
      fileRepository,
      resolveDependency(BaseLogger),
      resolveDependency(FILE_SERVICE_URLS_CACHING_DI_KEY),
    ),
  );

  // register MeiliSearch and its wrapper.
  registerValue(
    MeiliSearch,
    new MeiliSearch({
      host: MEILISEARCH_URL,
      apiKey: MEILISEARCH_MASTER_KEY,
    }),
  );

  // Register EtherPad
  const etherPadConfig = resolveDependency(EtherpadServiceConfig);

  // connect to etherpad server
  registerValue(
    Etherpad,
    wrapEtherpadErrors(
      new Etherpad({
        url: etherPadConfig.url,
        apiKey: etherPadConfig.apiKey,
        apiVersion: etherPadConfig.apiVersion,
      }),
    ),
  );

  registerValue(ETHERPAD_NAME_FACTORY_DI_KEY, new RandomPadNameFactory());

  registerValue(
    MailerService,
    new MailerService({
      connection: MAILER_CONNECTION,
      useSSL: MAILER_USE_SSL,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    }),
  );
};
