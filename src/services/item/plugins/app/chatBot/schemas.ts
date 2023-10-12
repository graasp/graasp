const chatBotDefinition = {
  type: 'object',
  required: ['role', 'content'],
  properties: {
    role: { type: 'string', enum: ['system', 'user'] },
    content: { type: 'string' },
  },
};

const create = {
  body: {
    type: 'array',
    items: chatBotDefinition, // TODO: change using $refs
    minItems: 1, // not allow empty array
  },
  response: {
    200: {
      completion: { type: 'string' },
    },
  },
};

export { create };
