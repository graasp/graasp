import { type Static, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { TagCategory } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../../../../plugins/typebox';
import { errorSchemaRef, itemTypeSchemaRef } from '../../../../../../../schemas/global';
import {
  GET_FEATURED_ITEMS_MAXIMUM,
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../../../../utils/config';
import { FILTERABLE_ATTRIBUTES } from './search.constants';

const meilisearchHitRef = registerSchemaAsRef(
  'searchHit',
  'Search Hit',
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
    type: itemTypeSchemaRef,
    isPublishedRoot: Type.Boolean(),
    isHidden: Type.Boolean(),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
    publicationUpdatedAt: customType.DateTime(),
    lang: Type.String(),
    likes: Type.Number(),
    thumbnails: Type.Optional(
      customType.StrictObject(
        {
          small: Type.String({ format: 'uri' }),
          medium: Type.String({ format: 'uri' }),
        },
        { additionalProperties: true },
      ),
    ),
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
      type: Type.String(),
      isPublishedRoot: Type.Boolean(),
      publicationUpdatedAt: customType.DateTime(),
      isHidden: Type.Boolean(),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      lang: Type.String(),
      likes: Type.Number(),
    }),
  }),
);

const meilisearchSearchResponseSchema = customType.StrictObject({
  totalHits: Type.Optional(Type.Number()),
  estimatedTotalHits: Type.Optional(Type.Number()),
  processingTimeMs: Type.Number(),
  query: Type.String(),
  hits: Type.Array(meilisearchHitRef),
});

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
      query: Type.String(),
      page: Type.Number(),
      hitsPerPage: Type.Number(),
      sort: Type.Array(Type.String()),
      highlightPreTag: Type.String(),
      highlightPostTag: Type.String(),
      // custom filter props
      tags: Type.Partial(Type.Record(Type.Enum(TagCategory), Type.Array(Type.String()))),
      langs: Type.Array(Type.String()),
      isPublishedRoot: Type.Boolean(),
      creatorId: customType.UUID(),
    }),
  ),
  response: {
    [StatusCodes.OK]: meilisearchSearchResponseSchema,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getFeatured = {
  operationId: 'getFeaturedCollections',
  tags: ['collection'],
  summary: 'Get featured collections',
  description: 'Get collections that we want to feature on the library home page.',

  querystring: customType.StrictObject({
    limit: Type.Optional(
      Type.Number({ minimum: 1, maximum: GET_FEATURED_ITEMS_MAXIMUM, default: 12 }),
    ),
  }),
  response: {
    [StatusCodes.OK]: meilisearchSearchResponseSchema,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getMostLiked = {
  operationId: 'getMostLikedCollections',
  tags: ['collection', 'like'],
  summary: 'Get most liked collections',
  description: 'Get most liked collections.',

  querystring: customType.StrictObject({
    limit: Type.Optional(
      Type.Number({ minimum: 1, maximum: GET_MOST_LIKED_ITEMS_MAXIMUM, default: 12 }),
    ),
  }),
  response: {
    [StatusCodes.OK]: meilisearchSearchResponseSchema,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getMostRecent = {
  operationId: 'getMostRecentCollections',
  tags: ['collection'],
  summary: 'Get most recent collections',
  description: 'Get most recently published and modified collections',

  querystring: customType.StrictObject({
    limit: Type.Optional(
      Type.Number({ minimum: 1, maximum: GET_MOST_RECENT_ITEMS_MAXIMUM, default: 12 }),
    ),
  }),
  response: {
    [StatusCodes.OK]: meilisearchSearchResponseSchema,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export type Hit = Static<(typeof search)['response']['200']>['hits'][0];

const facetOptions = Type.Union(FILTERABLE_ATTRIBUTES.map((attribute) => Type.Literal(attribute)));
export const getFacets = {
  operationId: 'getFacetsForName',
  tags: ['collection', 'search'],
  summary: 'Get facets for a given facet name',
  description:
    'Get list of facets and how many collections are tagged with those given a facet name.',

  querystring: customType.StrictObject({
    facetName: facetOptions,
  }),
  body: Type.Partial(
    customType.StrictObject({
      query: Type.String(),
      langs: Type.Array(Type.String()),
      isPublishedRoot: Type.Boolean(),
      facets: Type.Array(facetOptions),
      tags: Type.Partial(Type.Record(Type.Enum(TagCategory), Type.Array(Type.String()))),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Record(Type.String(), Type.Number()),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
