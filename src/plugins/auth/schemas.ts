export default {
  $id: 'http://graasp.org/members/',
};

const register = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' },
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

const mregister = {
  body: {
    type: 'object',
    required: ['name', 'email', 'challenge'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
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

const login = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
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
const passwordLogin = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
    additionalProperties: false,
  },
};

const updatePassword = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, pattern: '^\\S+( \\S+)*$' },
      password: { type: 'string' },
      currentPassword: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

const mlogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
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

const mPasswordLogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      password: { type: 'string' },
    },
    additionalProperties: false,
  },
};

const auth = {
  querystring: {
    type: 'object',
    required: ['t'],
    properties: {
      t: { type: 'string' },
    },
    additionalProperties: false,
  },
};

const mauth = {
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

const mdeepLink = {
  querystring: {
    type: 'object',
    required: ['t'],
    properties: {
      t: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export {
  register,
  mregister,
  login,
  passwordLogin,
  updatePassword,
  mlogin,
  mPasswordLogin,
  auth,
  mauth,
  mdeepLink,
};
