const register = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 }, // TODO: set length limits
      email: { type: 'string', format: 'email' }, // TODO: set length limits
    },
    additionalProperties: false
  },
};

const login = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' }, // TODO: set length limits
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
