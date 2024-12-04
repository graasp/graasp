import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../../../schemas/global';

export const search = {
  operationId: 'collectionSearch',
  tags: ['collection', 'search'],
  summary: 'Get collections given search query',
  description:
    'Get collections given search query. the results are highlighted given the search query.',

  body: customType.StrictObject({
    queries: Type.Array(
      Type.Composite(
        [
          customType.StrictObject({
            indexUid: Type.String(),
          }),
          Type.Partial(
            Type.Object(
              {
                attributesToHighlight: Type.Array(Type.String()),
                attributesToCrop: Type.Array(Type.String()),
                cropLength: Type.Number(),
                q: Type.String(),
                page: Type.Number(),
                limit: Type.Number(),
                sort: Type.Array(Type.String()),
                filter: Type.String(),
                highlightPreTag: Type.String(),
                highlightPostTag: Type.String(),
              },
              {
                additionalProperties: true,
              },
            ),
          ),
        ],
        { additionalProperties: false },
      ),
    ),
  }),
  response: {},
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
