import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemType, TagCategory } from '@graasp/sdk';

import { customType } from '../../../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../../../schemas/global';

export const search = {
  operationId: 'collectionSearch',
  tags: ['collection', 'search'],
  summary: 'Get collections given search query',
  description:
    'Get collections given search query. the results are highlighted given the search query.',

  body: Type.Partial(
    customType.StrictObject({
      attributesToHighlight: Type.Array(Type.String()),
      attributesToCrop: Type.Array(Type.String()),
      cropLength: Type.Number(),
      q: Type.String(),
      page: Type.Number(),
      limit: Type.Number(),
      sort: Type.Array(Type.String()),
      highlightPreTag: Type.String(),
      highlightPostTag: Type.String(),
      // custom filter props
      tags: Type.Partial(Type.Record(Type.Enum(TagCategory), Type.Array(Type.String()))),
      langs: Type.Array(Type.String()),
      isPublishedRoot: Type.Boolean(),
    }),
  ),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      results: Type.Array(
        customType.StrictObject({
          totalHits: Type.Optional(Type.Number()),
          estimatedTotalHits: Type.Optional(Type.Number()),
          hits: Type.Array(
            customType.StrictObject({
              name: Type.String(),
              description: Type.String(),
              content: Type.String(),
              creator: customType.StrictObject({
                id: customType.UUID(),
                name: Type.String(),
              }),
              level: Type.Array(Type.String()),
              discipline: Type.Array(Type.String()),
              'resource-type': Type.Array(Type.String()),
              id: customType.UUID(),
              type: Type.Enum(ItemType),
              isPublishedRoot: Type.Boolean(),
              isHidden: Type.Boolean(),
              createdAt: customType.DateTime(),
              updatedAt: customType.DateTime(),
              lang: Type.String(),
              _formatted: customType.StrictObject({
                name: Type.String(),
                description: Type.String(),
                content: Type.String(),
                creator: customType.StrictObject({
                  id: customType.UUID(),
                  name: Type.String(),
                }),
                level: Type.Array(Type.String()),
                discipline: Type.Array(Type.String()),
                'resource-type': Type.Array(Type.String()),
                id: customType.UUID(),
                type: Type.Enum(ItemType),
                isPublishedRoot: Type.Boolean(),
                isHidden: Type.Boolean(),
                createdAt: customType.DateTime(),
                updatedAt: customType.DateTime(),
                lang: Type.String(),
              }),
            }),
          ),
        }),
      ),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getFacets = {
  operationId: 'getCollectionFacets',
  tags: ['collection', 'search'],
  summary: 'Get collections facets',
  description: 'Get how many collections are tagged with given facets.',

  querystring: customType.StrictObject({
    facetName: Type.String({ description: 'Name of the facet' }),
    facetQuery: Type.Optional(Type.String({ description: 'Query to filter facets' })),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject(
      {
        facetHits: Type.Array(
          customType.StrictObject({
            value: Type.String(),
            count: Type.Number(),
          }),
        ),
        facetQuery: customType.Nullable(Type.String()),
        processingTimeMs: Type.Number(),
      },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
