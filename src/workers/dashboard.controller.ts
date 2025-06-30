import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { REDIS_CONNECTION } from '../config/redis';
import { Queues } from './config';

export const queueDashboardPlugin: FastifyPluginAsyncTypebox = async (instance) => {
  const serverAdapter = new FastifyAdapter();

  const queues = [
    new Queue(Queues.ItemExport.queueName, { connection: { url: REDIS_CONNECTION } }),
    new Queue(Queues.SearchIndex.queueName, { connection: { url: REDIS_CONNECTION } }),
  ];

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  serverAdapter.setBasePath('/admin/queues/ui');
  instance.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues/ui' });
};
