export const mregister = {
  body: {
    type: 'object',
    required: ['name', 'email', 'challenge', 'captcha'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const mlogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const mPasswordLogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge', 'password', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      password: { type: 'string' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const mauth = {
  body: {
    type: 'object',
    required: ['t', 'verifier'],
    properties: {
      t: { type: 'string' },
      verifier: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const authWeb = {
  querystring: {
    type: 'object',
    required: ['t'],
    properties: {
      t: { type: 'string' },
      url: { type: 'string' },
    },
    additionalProperties: false,
  },
};
