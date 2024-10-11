import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

export const search = {
  body: Type.Object(
    {
      queries: Type.Array(
        Type.Composite(
          [
            Type.Object(
              {
                indexUid: Type.String(),
              },
              {
                additionalProperties: false,
              },
            ),
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
                  additionalProperties: false,
                },
              ),
            ),
          ],
          { additionalProperties: false },
        ),
      ),
    },
    { additionalProperties: false },
  ),
  response: {},
} as const satisfies FastifySchema;
