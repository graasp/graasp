export const STRING_TYPE = { type: 'string' };
export const OBJECT_TYPE = { type: 'object' };
export const DATE_TYPE = {
  // To works with AJV (object date) and fastJson (string date)
  oneOf: [STRING_TYPE, OBJECT_TYPE],
};

export const buildRequireExactlySchema = (schema: object) => ({
  get required() {
    return Object.keys(this.properties);
  },
  additionalProperties: false,
  ...schema,
});

export const buildRequireExactlyObjectSchema = (properties: object) =>
  buildRequireExactlySchema({
    type: 'object',
    properties,
  });

export const buildRequireExactlyArraySchema = (items: object) => ({
  type: 'array',
  items,
});
