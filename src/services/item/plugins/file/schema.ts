import { Type } from '@sinclair/typebox';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';

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
  params: entityIdSchemaRef,
  querystring: Type.Object(
    { replyUrl: Type.Boolean({ default: false }) },
    { additionalProperties: false },
  ),
};
