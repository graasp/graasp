import { Queue } from 'bullmq';
import { v4 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { REDIS_CONNECTION } from '../config/redis';
import { QueueNames } from './config';
import { ItemExportRequestWorker } from './itemExportRequest.worker';

describe('ItemExport worker', () => {
  it('handles jobs', async () => {
    const ItemExportServiceMock = vi.fn();
    ItemExportServiceMock.prototype.exportFolderZipAndSendByEmail = vi.fn();

    const BaseLogger = vi.fn();
    BaseLogger.prototype.debug = vi.fn();
    BaseLogger.prototype.info = vi.fn();
    BaseLogger.prototype.warning = vi.fn();
    BaseLogger.prototype.error = vi.fn();

    const itemExportServiceMock = new ItemExportServiceMock();
    const _importExportRequestWorker = new ItemExportRequestWorker(
      itemExportServiceMock,
      new BaseLogger(),
    );
    const itemId = v4();
    const memberId = v4();
    const queue = new Queue(QueueNames.ItemExport, { connection: { url: REDIS_CONNECTION } });
    queue.add('export-folder-zip', {
      itemId,
      memberId,
    });

    await expect
      .poll(async () => {
        const completedJobs = await queue.getCompleted();
        const job = completedJobs.find((job) => job.data.itemId === itemId);
        return job;
      })
      .toBeTruthy();
    // expect the exportFolder to have been called
    expect(itemExportServiceMock.exportFolderZipAndSendByEmail).toHaveBeenCalled();
  });
});
