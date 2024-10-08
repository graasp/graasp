import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const upload = {
  params: Type.Object({}, { additionalProperties: false }),
};

const download = {
  params: Type.Object(
    {
      id: customType.UUID(),
      size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
    },
    { additionalProperties: false },
  ),
  querystring: Type.Object(
    {
      replyUrl: Type.Boolean({ default: false }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: errorSchemaRef,
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
};

export { upload, download };
