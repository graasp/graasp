import { Queue } from 'bullmq';
import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REDIS_CONNECTION } from '../config/redis';
import { Queues } from './config';
import { ItemExportRequestService } from './itemExportRequest.service';
import { ItemExportRequestWorker } from './itemExportRequest.worker';

// mock for the ItemExportRequestService
const ItemExportRequestServiceMock = vi.fn();
ItemExportRequestServiceMock.prototype.exportFolderZipAndSendByEmail = vi.fn();

// logger mock
const BaseLogger = vi.fn();
BaseLogger.prototype.debug = vi.fn();
BaseLogger.prototype.info = vi.fn();
BaseLogger.prototype.warning = vi.fn();
BaseLogger.prototype.error = vi.fn();

describe('ItemExportRequest worker', { sequential: true }, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('handles job', async () => {
    const itemExportRequestService: ItemExportRequestService = new ItemExportRequestServiceMock();
    const _importExportRequestWorker = new ItemExportRequestWorker(
      itemExportRequestService,
      new BaseLogger(),
    );
    const itemId = v4();
    const memberId = v4();
    const queue = new Queue(Queues.ItemExport.queueName, { connection: { url: REDIS_CONNECTION } });
    const job = await queue.add(Queues.ItemExport.jobs.exportFolderZip, {
      itemId,
      memberId,
    });

    await expect
      .poll(async () => {
        const jobs = await queue.getCompleted();
        const job = jobs.find(
          (job) =>
            job.name === Queues.ItemExport.jobs.exportFolderZip && job.data.itemId === itemId,
        );
        return job;
      })
      .toBeTruthy();
    expect(job.isCompleted).toBeTruthy();

    // expect the exportFolder to have been called
    expect(itemExportRequestService.exportFolderZipAndSendByEmail).toHaveBeenCalled();
    await queue.close();
  });

  it('fail if processing throws', async () => {
    const itemExportRequestService: ItemExportRequestService = new ItemExportRequestServiceMock();
    // make the export processing fail
    vi.mocked(itemExportRequestService).exportFolderZipAndSendByEmail.mockRejectedValueOnce(
      new Error('unexpected precessing error'),
    );
    const _importExportRequestWorker = new ItemExportRequestWorker(
      itemExportRequestService,
      new BaseLogger(),
    );
    const itemId = v4();
    const memberId = v4();
    const queue = new Queue(Queues.ItemExport.queueName, { connection: { url: REDIS_CONNECTION } });
    await queue.add(Queues.ItemExport.jobs.exportFolderZip, {
      itemId,
      memberId,
    });

    await expect
      .poll(async () => {
        const failedJobs = await queue.getFailed();
        const job = failedJobs.find(
          (job) =>
            job.name === Queues.ItemExport.jobs.exportFolderZip && job.data.itemId === itemId,
        );
        return job;
      })
      .toBeTruthy();
    // expect the exportFolder to have been called
    expect(itemExportRequestService.exportFolderZipAndSendByEmail).toHaveBeenCalled();
    await queue.close();
  });

  it('fail with wrong data', async () => {
    const itemExportRequestService: ItemExportRequestService = new ItemExportRequestServiceMock();
    const _importExportRequestWorker = new ItemExportRequestWorker(
      itemExportRequestService,
      new BaseLogger(),
    );
    const queue = new Queue(Queues.ItemExport.queueName, { connection: { url: REDIS_CONNECTION } });
    await queue.add(Queues.ItemExport.jobs.exportFolderZip, {
      toto: 'tutu',
    });

    await expect
      .poll(async () => {
        const jobs = await queue.getFailed();
        const job = jobs.find(
          (job) => job.name === Queues.ItemExport.jobs.exportFolderZip && job.data.toto === 'tutu',
        );
        return job;
      })
      .toBeTruthy();
    // expect the exportFolder to not have been called
    expect(itemExportRequestService.exportFolderZipAndSendByEmail).not.toHaveBeenCalled();
    await queue.close();
  });
});
