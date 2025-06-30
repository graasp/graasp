import { type Job, Worker } from 'bullmq';

import { REDIS_CONNECTION } from '../config/redis';
import { BaseLogger } from '../logger';
import { Queues } from './config';
import { SearchIndexService } from './searchIndex.service';

type BuildIndexJob = Job;

// define a local alias
const JobTypes = Queues.SearchIndex.jobs;

export class SearchIndexWorker {
  private readonly SearchIndexService: SearchIndexService;
  private readonly logger: BaseLogger;
  private worker: Worker;

  constructor(SearchIndexService: SearchIndexService, logger: BaseLogger) {
    this.logger = logger;
    this.SearchIndexService = SearchIndexService;

    this.worker = new Worker(
      Queues.SearchIndex.queueName,
      async (job: BuildIndexJob) => {
        switch (job.name) {
          case JobTypes.buildIndex: {
            await this.SearchIndexService.buildIndex();
            return 'success';
          }
          // other job type this worker can handle
        }
      },
      {
        connection: { url: REDIS_CONNECTION },
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.info(`${job.id} has completed!`);
    });

    this.worker.on('active', (job) => {
      this.logger.info(`${job.id} is now active!`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.info(`${job?.id ?? 'unknown job'} has failed with ${err.message}`);
    });

    this.worker.on('error', (err) => {
      // log the error
      this.logger.error(err);
    });
  }
}
