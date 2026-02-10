import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemCommonSchema } from '../../common.schemas';
import { geoCoordinateSchemaRef } from '../geolocation/itemGeolocation.schemas';

const pageSchema = Type.Composite([
  itemCommonSchema,
  customType.StrictObject(
    {
      type: Type.Literal('page'),
      extra: customType.StrictObject({}),
    },
    {
      title: 'Page',
      description: 'Item of type page.',
    },
  ),
]);

export const pageItemSchemaRef = registerSchemaAsRef('pageItem', 'Page Item', pageSchema);

export const createPage = {
  operationId: 'createPage',
  tags: ['item', 'page'],
  summary: 'Create page',
  description: 'Create page and its content.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    Type.Pick(pageSchema, ['name']),
    Type.Partial(Type.Pick(pageSchema, ['lang', 'settings'])),
    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ]),
  response: { [StatusCodes.CREATED]: pageSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const pageWebsocketsSchema = {
  operationId: 'pagesWebsockets',
  tags: ['item', 'page', 'websockets'],
  summary: 'Connect to websockets for a page',
  description: 'Connect to websockets for a page and allow collaboration through yjs.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
} as const satisfies FastifySchema;
