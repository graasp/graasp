import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../schemas/global.js';
import { itemSchema, itemSchemaRef } from '../../schemas.js';

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
  querystring: customType.StrictObject({
    /**
     * @deprecated we don't use this parameter anymore. This should be removed app once the mobile is deprecated.
     */
    replyUrl: Type.Boolean({ default: true, deprecated: true }),
  }),
  response: {
    [StatusCodes.OK]: Type.String({ format: 'uri' }),
    '4xx': errorSchemaRef,
  },
};

export const updateFile = {
  operationId: 'updateFile',
  tags: ['item', 'file'],
  summary: 'Update file',
  description: 'Update file.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(Type.Pick(itemSchema, ['name', 'description', 'lang', 'settings']), {
    minProperties: 1,
  }),
  response: {
    [StatusCodes.OK]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};
