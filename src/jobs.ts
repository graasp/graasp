import { ConnectionOptions, Queue } from 'bullmq';
import { Worker } from 'bullmq';

import { FastifyBaseLogger } from 'fastify';

import { SearchService } from './services/item/plugins/published/plugins/search/service';
import {
  JOB_SCHEDULING,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from './utils/config';

const connection: ConnectionOptions = {
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT ?? '6379'),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
};

const CRON_3AM_MONDAY = '0 3 * * 1';

// Currently a single worker will handle all of the scheduled job. If performance problem arises, consider having a queue/worker per job.
export class JobService {
  // Add every regularly scheduled job here
  scheduledTasks: Record<string, { handler: () => void; pattern: string }> = {
    'rebuild-index': {
      handler: () => this.searchService.rebuildIndex(),
      pattern: CRON_3AM_MONDAY,
    },
  };

  scheduledJobsWorker = new Worker(
    'scheduled-jobs',
    async (job) => {
      this.scheduledTasks[job.name].handler();
    },
    {
      connection,
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 100 },
    },
  );

  scheduledJobsQueue = new Queue('scheduled-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  searchService: SearchService;
  logger: FastifyBaseLogger;

  constructor(searchService: SearchService, logger: FastifyBaseLogger) {
    this.searchService = searchService;
    this.logger = logger;

    if (JOB_SCHEDULING) {
      this.setupWorker();
      this.setupJobs();
    }
  }

  private setupWorker() {
    this.scheduledJobsWorker.on('completed', (job) => {
      this.logger.info(`${job.id} has completed!`);
    });

    this.scheduledJobsWorker.on('active', (job) => {
      this.logger.info(`${job.id} is now active!`);
    });

    this.scheduledJobsWorker.on('failed', (job, err) => {
      this.logger.info(`${job?.id ?? 'unknown job'} has failed with ${err.message}`);
    });

    this.scheduledJobsWorker.on('error', (err) => {
      // log the error
      console.error(err);
    });
  }

  private async setupJobs() {
    // Remove existing repeatable jobs
    const repeatable = await this.scheduledJobsQueue.getRepeatableJobs();

    repeatable.forEach(async (job) => {
      await this.scheduledJobsQueue.removeRepeatableByKey(job.key);
    });

    // Add repeatable jobs from config
    for (const jobKey of Object.keys(this.scheduledTasks)) {
      this.logger.info(
        `Scheduling job ${jobKey} with pattern: ${this.scheduledTasks[jobKey].pattern}`,
      );
      this.scheduledJobsQueue.add(
        jobKey,
        {},
        {
          repeat: {
            pattern: this.scheduledTasks[jobKey].pattern,
          },
        },
      );
    }
  }
}
