import { ChatbotRole, GPTVersion } from '@graasp/sdk';

const chatBotDefinition = {
  type: 'object',
  required: ['role', 'content'],
  properties: {
    role: { type: 'string', enum: Object.values(ChatbotRole) },
    content: { type: 'string' },
  },
};

const create = {
  body: {
    type: 'array',
    items: chatBotDefinition,
    minItems: 1, // do not allow empty array
  },
  querystring: {
    type: 'object',
    properties: {
      gptVersion: { type: 'string', enum: Object.values(GPTVersion) },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      completion: { type: 'string' },
      model: { type: 'string' },
    },
  },
};

export { create };
