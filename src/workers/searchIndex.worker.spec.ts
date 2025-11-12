import { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REDIS_CONNECTION } from '../config/redis';
import { Queues } from './config';
import { SearchIndexService } from './searchIndex.service';
import { SearchIndexWorker } from './searchIndex.worker';

// mock for the SearchIndexService
const SearchIndexServiceMock = vi.fn();
SearchIndexServiceMock.prototype.buildIndex = vi.fn();

// logger mock
const BaseLogger = vi.fn();
BaseLogger.prototype.debug = vi.fn();
BaseLogger.prototype.info = vi.fn();
BaseLogger.prototype.warning = vi.fn();
BaseLogger.prototype.error = vi.fn();

describe('SearchIndex worker', { sequential: true }, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('handles job', async () => {
    const searchIndexService: SearchIndexService = new SearchIndexServiceMock();
    const _worker = new SearchIndexWorker(searchIndexService, new BaseLogger());
    const queue = new Queue(Queues.SearchIndex.queueName, {
      connection: { url: REDIS_CONNECTION },
    });
    const job = await queue.add(Queues.SearchIndex.jobs.buildIndex, {});

    await expect
      .poll(async () => {
        const jobs = await queue.getCompleted();
        const job = jobs.find((job) => job.name === Queues.SearchIndex.jobs.buildIndex);
        return job;
      })
      .toBeTruthy();
    expect(job.isCompleted).toBeTruthy();

    // expect the exportFolder to have been called
    expect(searchIndexService.buildIndex).toHaveBeenCalled();
    await queue.close();
  });

  it('fail if processing throws', async () => {
    const searchIndexService: SearchIndexService = new SearchIndexServiceMock();
    // make the export processing fail
    vi.mocked(searchIndexService).buildIndex.mockRejectedValueOnce(
      new Error('unexpected precessing error'),
    );
    const _worker = new SearchIndexWorker(searchIndexService, new BaseLogger());
    const queue = new Queue(Queues.SearchIndex.queueName, {
      connection: { url: REDIS_CONNECTION },
    });
    await queue.add(Queues.SearchIndex.jobs.buildIndex, {});

    await expect
      .poll(async () => {
        const failedJobs = await queue.getFailed();
        const job = failedJobs.find((job) => job.name === Queues.SearchIndex.jobs.buildIndex);
        return job;
      })
      .toBeTruthy();
    // expect the exportFolder to have been called
    expect(searchIndexService.buildIndex).toHaveBeenCalled();
    await queue.close();
  });
});
