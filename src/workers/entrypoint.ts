import 'reflect-metadata';

import { registerDependencies } from '../di/container';
import { resolveDependency } from '../di/utils';
import { CRON_3AM_MONDAY, JobServiceBuilder } from '../jobs';
import { BaseLogger } from '../logger';
import { SearchService } from '../services/item/plugins/publication/published/plugins/search/search.service';
import { ItemExportRequestService } from './itemExportRequest.service';
import { ItemExportRequestWorker } from './itemExportRequest.worker';

const start = async () => {
  // register tsyringe dependencies
  // FIXME
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  registerDependencies(console);
  const logger = resolveDependency(BaseLogger);

  logger.debug('START WORKERS');

  // worker for rebuild meilisearch index
  const jobServiceBuilder = new JobServiceBuilder(resolveDependency(BaseLogger));
  jobServiceBuilder
    .registerTask('rebuild-index', {
      handler: () => resolveDependency(SearchService).rebuildIndex(),
      pattern: CRON_3AM_MONDAY,
    })
    .build();

  // start item export request worker
  const itemExportRequestService = resolveDependency(ItemExportRequestService);
  new ItemExportRequestWorker(itemExportRequestService, logger);
};

start();
