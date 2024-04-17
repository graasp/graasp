export const STRING_TYPE = { type: 'string' };
export const OBJECT_TYPE = { type: 'object' };
export const DATE_TYPE = {
  // To works with AJV (object date) and fastJson (string date)
  oneOf: [STRING_TYPE, OBJECT_TYPE],
};
export const ONE_OF = (types: object[]) => ({
  oneOf: types,
});

type BuildSchemaOptions = { nullable?: boolean; requiredProps?: string[] };

const buildSchema = (
  schema: object,
  { nullable, requiredProps }: BuildSchemaOptions = { nullable: false },
) => ({
  get required() {
    return requiredProps ?? Object.keys(this.properties ?? {});
  },
  additionalProperties: false,
  nullable,
  ...schema,
});

export const buildObjectSchema = (properties: object, options: BuildSchemaOptions = {}) =>
  buildSchema(
    {
      type: 'object',
      properties,
    },
    options,
  );

export const buildArraySchema = (childrenSchema: object, options: BuildSchemaOptions = {}) =>
  buildSchema(
    {
      type: 'array',
      items: childrenSchema,
    },
    options,
  );
