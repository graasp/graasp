import { FastifySchema } from 'fastify';

import { itemIdSchemaRef } from '../../../schemas';

export const getPublicationState = {
  params: itemIdSchemaRef,
} as const satisfies FastifySchema;
