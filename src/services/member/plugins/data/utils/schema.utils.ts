export type PropertyType = { type: string };
export type OneOfType = { oneOf: PropertyType[] };
export type SchemaType = {
  type: string;
  properties: { [prop: string]: PropertyType | OneOfType | SchemaType };
};
// Extract Properties of Schema Type without the properties attribute
type SchemaProperties = {
  [P in keyof SchemaType['properties']]: SchemaType['properties'][P];
};
type BuildSchemaOptions = { nullable?: boolean; requiredProps?: string[] };

export const ONE_OF = (types: PropertyType[]) => ({
  oneOf: types,
});
export const STRING_TYPE = { type: 'string' };
export const OBJECT_TYPE = { type: 'object' };
// To works with AJV (object date) and fastJson (string date)
export const DATE_TYPE = ONE_OF([STRING_TYPE, OBJECT_TYPE]);
export const NULL_TYPE = { type: 'null' };
export const NULLABLE_TYPE = (type: PropertyType) => ONE_OF([type, NULL_TYPE]);

const buildSchema = (
  schema: SchemaType,
  { nullable, requiredProps }: BuildSchemaOptions = { nullable: false },
) => ({
  get required() {
    return requiredProps ?? Object.keys(this.properties ?? {});
  },
  additionalProperties: false,
  nullable,
  ...schema,
});

export const buildObjectSchema = (properties: SchemaProperties, options: BuildSchemaOptions = {}) =>
  buildSchema(
    {
      type: 'object',
      properties,
    },
    options,
  );

export const buildArraySchema = (childrenSchema: SchemaType) => ({
  type: 'array',
  items: childrenSchema,
});
