export const register = {
  body: {
    type: 'object',
    required: ['name', 'email', 'captcha'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
      url: {
        type: 'string',
      },
    },
    additionalProperties: false,
  },
};
export const login = {
  body: {
    type: 'object',
    required: ['email', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
      url: {
        type: 'string',
      },
    },
    additionalProperties: false,
  },
};
export const auth = {
  querystring: {
    type: 'object',
    required: ['t'],
    properties: {
      t: { type: 'string' },
      url: {
        type: 'string',
      },
    },
    additionalProperties: false,
  },
};
