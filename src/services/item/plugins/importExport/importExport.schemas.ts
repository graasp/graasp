import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const zipImport = {
  operationId: 'importZip',
  tags: ['item', 'import'],
  summary: 'Import ZIP content',
  description:
    'Import and extract the content of a ZIP, creating the corresponding structure and items.',

  querystring: customType.StrictObject({
    parentId: Type.Optional(
      customType.UUID({
        description: 'Folder which the import should be extracted in.',
      }),
    ),
  }),
  response: {
    [StatusCodes.ACCEPTED]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const downloadFile = {
  operationId: 'downloadFile',
  tags: ['item', 'export'],
  summary: 'Download non-folder content',
  description: 'Download non-folder content. Return raw file for single item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    // return a stream
    [StatusCodes.OK]: Type.Any({
      description: 'a stream of data for the export zip content',
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const exportZip = {
  operationId: 'exportZip',
  tags: ['item', 'export'],
  summary: 'Export folder content as zip archive',
  description:
    "Export the folder's content as a ZIP archive. The user will receive an email with a link to download the ZIP archive. Users can download any resource they can access.",

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.ACCEPTED]: customType.StrictObject({
      message: Type.String({
        description: 'email with download link has been sent',
      }),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const graaspZipExport = {
  operationId: 'graaspZipExport',
  tags: ['item', 'export'],
  summary: 'Export content',
  description:
    'Export content. Return raw file for single item, or a ZIP with structure and items for a folder.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    // return a stream
    [StatusCodes.OK]: Type.Any({
      description: 'a stream of data for the graasp export content',
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
