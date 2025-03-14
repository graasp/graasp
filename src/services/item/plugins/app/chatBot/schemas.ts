import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ChatbotRole, GPTVersion } from '@graasp/sdk';

import { customType } from '../../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../../schemas/global.js';
import {
  OPENAI_GPT_VERSION,
  OPENAI_MAX_TEMPERATURE,
  OPENAI_MIN_TEMPERATURE,
} from '../../../../../utils/config.js';

export const create = {
  operationId: 'createChatbotCompletionPrompt',
  tags: ['app', 'app-chatbot'],
  summary: 'Get a prompt completion from a chatbot',
  description: 'Given a prompt, it returns a completion from a chatbot.',

  body: Type.Array(
    Type.Object(
      {
        role: Type.Enum(ChatbotRole),
        content: Type.String(),
      },
      {
        description: 'Chatbot Completion Prompt',
      },
    ),
    { minItems: 1 },
  ),
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    gptVersion: Type.Optional(
      Type.Enum(GPTVersion, { description: 'Model to use', default: OPENAI_GPT_VERSION }),
    ),
    temperature: Type.Optional(
      Type.Number({ maximum: OPENAI_MAX_TEMPERATURE, minimum: OPENAI_MIN_TEMPERATURE }),
    ),
  }),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        completion: customType.Nullable(Type.String()),
        model: Type.Optional(Type.String()),
      },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
};
