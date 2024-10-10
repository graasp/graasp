import { FastifySchema } from 'fastify';

import { itemIdSchemaRef } from '../../../schema';

export const getPublicationState = {
  params: itemIdSchemaRef,
} as const satisfies FastifySchema;
