import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../../../schemas/global';
import { appDataSchemaRef } from '../../schemas';

export const upload = {
  operationId: 'createAppDataFile',
  tags: ['app', 'app-data', 'file'],
  summary: 'Create app data file',
  description: 'Upload a file to create a corresponding app data.',

  response: {
    [StatusCodes.OK]: appDataSchemaRef,
    '4xx': errorSchemaRef,
  },
};

export const download = {
  operationId: 'downloadAppDataFile',
  tags: ['app', 'app-data', 'file'],
  summary: 'Download app data file',
  description: 'Download app data file.',

  params: customType.StrictObject({
    id: customType.UUID({
      description: 'Id of the app data corresponding to the file to download',
    }),
  }),
  querystring: customType.StrictObject({
    replyUrl: Type.Boolean({
      default: false,
    }),
  }),

  response: {
    [StatusCodes.OK]: Type.String({ format: 'uri' }),
    '4xx': errorSchemaRef,
  },
};
