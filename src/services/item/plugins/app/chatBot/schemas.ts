import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ChatbotRole, GPTVersion } from '@graasp/sdk';

import { customType } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';

const chatBotDefinition = Type.Object(
  {
    role: Type.Enum(ChatbotRole),
    content: Type.String(),
  },
  {
    description: 'Chatbot',
  },
);

export const create = {
  operationId: 'createAppChatbotPrompt',
  tags: ['app', 'chatbot'],
  summary: 'Create app chatbot prompt',
  description: 'Create app chatbot prompt.',

  body: Type.Array(chatBotDefinition, { minItems: 1 }),
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  querystring: customType.StrictObject({
    gptVersion: Type.Optional(Type.Enum(GPTVersion)),
  }),
  response: {
    [StatusCodes.OK]: Type.Object({
      completion: customType.Nullable(Type.String()),
      model: Type.Optional(Type.String()),
    }),
    '4xx': errorSchemaRef,
  },
};
