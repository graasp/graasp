import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { AppDataVisibility } from '@graasp/sdk';

import { customType } from '../../../../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../../../../schemas/global.js';
import { APP_DATA_TYPE_FILE } from '../../../constants.js';

export const upload = {
  operationId: 'createAppDataFile',
  tags: ['app', 'app-data', 'file'],
  summary: 'Create app data file',
  description: `Upload a file to create a corresponding app data. The created app data will be "${APP_DATA_TYPE_FILE}" and visibility ${AppDataVisibility.Member}. The data property will contain the file properties.`,

  response: {
    [StatusCodes.OK]: Type.Null(),
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
