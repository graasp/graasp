import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef } from '../../schemas';

export const upload = {
  operationId: 'uploadFile',
  tags: ['item', 'file'],
  summary: 'Upload files',
  description: 'Upload files to create corresponding items.',

  querystring: customType.StrictObject({
    id: Type.Optional(
      customType.UUID({
        description: 'Folder id in which the uploaded files should be created.',
      }),
    ),
    previousItemId: Type.Optional(
      customType.UUID({ description: 'The uploaded files should be created after this item.' }),
    ),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      data: Type.Record(customType.UUID(), itemSchemaRef),
      errors: Type.Array(errorSchemaRef),
    }),
    '4xx': errorSchemaRef,
  },
};

export const download = {
  operationId: 'downloadFile',
  tags: ['item', 'file'],
  summary: 'Download file',
  description: 'Download file.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: customType.StrictObject({ replyUrl: Type.Boolean({ default: false }) }),
  response: {
    [StatusCodes.OK]: Type.String({ format: 'uri' }),
    '4xx': errorSchemaRef,
  },
};
