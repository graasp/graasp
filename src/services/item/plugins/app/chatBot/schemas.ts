import { ChatbotRole } from '@graasp/sdk';

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
  response: {
    200: {
      completion: { type: 'string' },
      model: { type: 'string' },
    },
  },
};

export { create };
