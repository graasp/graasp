import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../schemas/global.js';

export const zipImport = {
  operationId: 'importZip',
  tags: ['item', 'import'],
  summary: 'Import ZIP content',
  description:
    'Import and extract the content of a ZIP, creating the corresponding structure and items.',

  querystring: customType.StrictObject({
    parentId: Type.Optional(
      customType.UUID({ description: 'Folder which the import should be extracted in.' }),
    ),
  }),
  response: {
    [StatusCodes.ACCEPTED]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const zipExport = {
  operationId: 'exportZip',
  tags: ['item', 'export'],
  summary: 'Export content',
  description:
    'Export content. Return raw file for single item, or a ZIP with structure and items for a folder.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    // return a stream
    [StatusCodes.OK]: { content: Type.String() },
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
