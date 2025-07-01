import { type Job, Worker } from 'bullmq';
import { validate } from 'uuid';

import { REDIS_CONNECTION } from '../config/redis';
import { db } from '../drizzle/db';
import { BaseLogger } from '../logger';
import { Queues } from './config';
import { ItemExportRequestService } from './itemExportRequest.service';

type ExportFolderZipJob = Job<{
  itemId: string;
  memberId: string;
}>;

// define a local alias
const JobTypes = Queues.ItemExport.jobs;

export class ItemExportRequestWorker {
  private readonly itemExportRequestService: ItemExportRequestService;
  private readonly logger: BaseLogger;
  private worker: Worker;

  constructor(itemExportRequestService: ItemExportRequestService, logger: BaseLogger) {
    this.logger = logger;
    this.itemExportRequestService = itemExportRequestService;

    this.worker = new Worker(
      Queues.ItemExport.queueName,
      async (job: ExportFolderZipJob) => {
        switch (job.name) {
          case JobTypes.exportFolderZip: {
            const { itemId, memberId } = job.data;
            if (validate(itemId) && validate(memberId)) {
              await db.transaction(async (tx) => {
                await this.itemExportRequestService.exportFolderZipAndSendByEmail(
                  tx,
                  itemId,
                  memberId,
                );
              });
              return 'success';
            } else {
              this.logger.info(
                `Worker for "${Queues.ItemExport.queueName}" got an unexpected job name "${job.name}. This job will be removed and not processed."`,
              );
              await job.remove();
            }
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
      this.logger.info(`${job.queueName}'s ${job.id} has completed!`);
    });

    this.worker.on('active', (job) => {
      this.logger.info(`${job.queueName}'s ${job.id} is now active!`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.info(
        `${job?.queueName}'s ${job?.id ?? 'unknown job'} has failed with ${err.message}`,
      );
    });

    this.worker.on('error', (err) => {
      // log the error
      this.logger.error(err);
    });
  }
}
