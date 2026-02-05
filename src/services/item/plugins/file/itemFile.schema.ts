import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../item.schemas';

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
      customType.UUID({
        description: 'The uploaded files should be created after this item.',
      }),
    ),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: customType.StrictObject({
      message: Type.String({ description: 'Successful response' }),
    }),
    '4xx': errorSchemaRef,
  },
};

export const getUrl = {
  operationId: 'getUrl',
  tags: ['item', 'file'],
  summary: 'Get file URL',
  description: 'Get file URL.',

  params: customType.StrictObject({
    id: customType.UUID(),
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
