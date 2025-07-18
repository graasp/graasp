import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../item.schemas';
import { geoCoordinateSchemaRef } from '../geolocation/itemGeolocation.schemas';

export const pageSchema = Type.Composite([
  itemSchema,
  customType.StrictObject(
    {
      extra: customType.StrictObject({}),
    },
    {
      title: 'Page',
      description: 'Item of type page.',
    },
  ),
]);

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
