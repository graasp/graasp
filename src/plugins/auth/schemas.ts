const register = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
    },
    additionalProperties: false
  },
};

const login = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
    },
    additionalProperties: false
  },
};

const auth = {
  querystring: {
    type: 'object',
    properties: {
      t: { type: 'string' }
    },
    additionalProperties: false
  }
};

export {
  register,
  login,
  auth
};
