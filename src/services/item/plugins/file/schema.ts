import { Type } from '@sinclair/typebox';

import { customType } from '../../../../plugins/typebox';

export const upload = {
  querystring: Type.Partial(
    Type.Object(
      {
        id: customType.UUID(),
        previousItemId: customType.UUID(),
      },
      {
        additionalProperties: false,
      },
    ),
  ),
};

export const download = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Object(
    { replyUrl: Type.Boolean({ default: false }) },
    { additionalProperties: false },
  ),
};
