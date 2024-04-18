export const ONE_OF = (types: object[]) => ({
  oneOf: types,
});
export const STRING_TYPE = { type: 'string' };
export const OBJECT_TYPE = { type: 'object' };
// To works with AJV (object date) and fastJson (string date)
export const DATE_TYPE = ONE_OF([STRING_TYPE, OBJECT_TYPE]);
export const NULL_TYPE = { type: 'null' };
export const NULLABLE_TYPE = (type: object) => ONE_OF([type, NULL_TYPE]);
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

export const buildArraySchema = (childrenSchema: object) => ({
  type: 'array',
  items: childrenSchema,
});
