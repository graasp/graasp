export default {
  type: 'object',
  required: ['PORT', 'PG_CONNECTION_URI'],
  properties: {
    PORT: { type: 'string', default: 3000 },
    PG_CONNECTION_URI: { type: 'string' },
    DATABASE_LOGS: { type: 'boolean' },
    ROARR_LOG: { type: 'boolean' }
  }
};
