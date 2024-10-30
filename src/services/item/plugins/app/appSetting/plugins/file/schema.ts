import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../../../schemas/global';
import { appSettingSchemaRef } from '../../schemas';

export const upload = {
  operationId: 'createAppSettingFile',
  tags: ['app', 'app-setting', 'file'],
  summary: 'Create app setting file',
  description: 'Upload a file to create a corresponding app setting.',

  response: {
    [StatusCodes.OK]: appSettingSchemaRef,
    '4xx': errorSchemaRef,
  },
};

export const download = {
  operationId: 'downloadAppSettingFile',
  tags: ['app', 'app-setting', 'file'],
  summary: 'Download app setting file',
  description: 'Download app setting file.',

  params: customType.StrictObject({
    id: customType.UUID({
      description: 'Id of the app setting corresponding to the file to download',
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
