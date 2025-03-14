import { FastifySchema } from 'fastify';

import { customType } from '../../../../../plugins/typebox.js';

export const getPublicationState = {
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
} as const satisfies FastifySchema;
