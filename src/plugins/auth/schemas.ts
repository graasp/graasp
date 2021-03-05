const register = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' }
    },
    additionalProperties: false
  }
};

const login = {
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' }
    },
    additionalProperties: false
  },
};

const auth = {
  querystring: {
    type: 'object',
    required: ['t'],
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
