import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { QueueNames, REDIS_CONNECTION } from './config';

export const queueDashboardPlugin: FastifyPluginAsyncTypebox = async (instance) => {
  const serverAdapter = new FastifyAdapter();

  const queues = [new Queue(QueueNames.ItemExport, { connection: REDIS_CONNECTION })];

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  serverAdapter.setBasePath('/ui');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  instance.register(serverAdapter.registerPlugin(), { prefix: '/ui' });
};
