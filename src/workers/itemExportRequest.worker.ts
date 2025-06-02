import { type Job, Worker } from 'bullmq';

import { db } from '../drizzle/db';
import { BaseLogger } from '../logger';
import { QueueNames, REDIS_CONNECTION } from './config';
import { ItemExportRequestService } from './itemExportRequest.service';

type ExportFolderZipJob = Job<{
  itemId: string;
  memberId: string;
}>;

export class ItemExportRequestWorker {
  private readonly logger: BaseLogger;
  itemExportRequestService: ItemExportRequestService;

  constructor(itemExportRequestService: ItemExportRequestService, logger: BaseLogger) {
    this.logger = logger;
    this.itemExportRequestService = itemExportRequestService;

    const worker = new Worker(
      QueueNames.ItemExport,
      async (job: ExportFolderZipJob) => {
        await db.transaction(async (tx) => {
          const { itemId, memberId } = job.data;
          await this.itemExportRequestService.exportFolderZipAndSendByEmail(tx, itemId, memberId);
        });
        return 'success';
      },
      {
        connection: REDIS_CONNECTION,
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    );

    worker.on('completed', (job) => {
      this.logger.info(`${job.id} has completed!`);
    });

    worker.on('active', (job) => {
      this.logger.info(`${job.id} is now active!`);
    });

    worker.on('failed', (job, err) => {
      this.logger.info(`${job?.id ?? 'unknown job'} has failed with ${err.message}`);
    });

    worker.on('error', (err) => {
      // log the error
      console.error(err);
    });
  }
}
