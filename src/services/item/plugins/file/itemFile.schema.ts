import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemCommonSchema } from '../../common.schemas';

const fileItemSchema = Type.Composite(
  [
    itemCommonSchema,
    customType.StrictObject({
      type: Type.Literal('file'),
      extra: customType.StrictObject({
        file: customType.StrictObject({
          name: Type.String(),
          path: Type.String(),
          mimetype: Type.String(),
          size: Type.Integer({ minimum: 0 }),
          altText: Type.Optional(
            Type.String({
              description: 'alternative text of the file if it is an image',
            }),
          ),
          content: Type.Optional(
            Type.String({
              description: 'content of the file if it is readable',
            }),
          ),
          key: Type.Optional(Type.String({ deprecated: true })),
          contenttype: Type.Optional(Type.String({ deprecated: true })),
        }),
      }),
    }),
  ],
  {
    title: 'File',
    description: 'Item of type file, represents a file.',
  },
);

export const fileItemSchemaRef = registerSchemaAsRef('fileItem', 'File Item', fileItemSchema);

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
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
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
  body: Type.Partial(Type.Pick(fileItemSchema, ['name', 'description', 'lang', 'settings']), {
    minProperties: 1,
  }),
  response: {
    [StatusCodes.OK]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};
