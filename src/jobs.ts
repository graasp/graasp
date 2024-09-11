/*
import { ConnectionOptions, Queue, Worker } from 'bullmq';

import { BaseLogger } from './logger';
import {
  JOB_SCHEDULING,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from './utils/config';

const connection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
};

export const CRON_3AM_MONDAY = '0 3 * * 1';

type Task = { handler: () => void; pattern: string };

export class JobServiceBuilder {
  private readonly scheduledTasks: Record<string, Task> = {};
  private readonly baseLogger: BaseLogger;

  constructor(baseLogger: BaseLogger) {
    this.baseLogger = baseLogger;
  }

  public registerTask(taskName: string, task: Task) {
    this.scheduledTasks[taskName] = task;
    return this;
  }

  public build() {
    return new JobService(this.scheduledTasks, this.baseLogger);
  }
}

// Currently a single worker will handle all of the scheduled job. If performance problem arises, consider having a queue/worker per job.
export class JobService {
  private readonly logger: BaseLogger;
  private readonly scheduledTasks: Record<string, Task> = {};
  private readonly scheduledJobsWorker: Worker;
  private readonly scheduledJobsQueue: Queue;

  constructor(scheduledTasks: Record<string, Task>, logger: BaseLogger) {
    this.scheduledTasks = scheduledTasks;
    this.logger = logger;

    this.scheduledJobsWorker = new Worker(
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

    this.scheduledJobsQueue = new Queue('scheduled-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

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
*/
