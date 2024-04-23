import { FindOptionsSelect } from 'typeorm';

import { OBJECT_TYPE, OneOfType, PropertyType, STRING_TYPE, SchemaType } from './schema.utils';

// convert string schema type to column selection.
const stringSchemaToSelectMapper = (columnName: string) => ({ [columnName]: true });
// convert object schema type to column selection.
const objectSchemaToSelectMapper = (columnName: string) => ({ [columnName]: {} });
// convert single schema type to column selection.
const propertyToSelectMapper = (columnName: string, property: PropertyType) => {
  if (property === STRING_TYPE) {
    return stringSchemaToSelectMapper(columnName);
  } else if (property === OBJECT_TYPE) {
    return objectSchemaToSelectMapper(columnName);
  }
  throw new Error(`${property.type} is not a valid type`);
};
// convert one of schema type to column selection.
const oneOfToSelectMapper = (columnName: string, value: OneOfType) => {
  if (value.oneOf.find((e) => e === STRING_TYPE)) {
    return stringSchemaToSelectMapper(columnName);
  } else if (value.oneOf.find((e) => e === OBJECT_TYPE)) {
    return objectSchemaToSelectMapper(columnName);
  }
  throw new Error(`${JSON.stringify(value.oneOf)} does not contain a valid type`);
};

/**
 * Convert a JSON Schema to a TypeORM FindOptionSelect
 * to select only the columns that are presents in the schema.
 * @param schema The schema to convert to a selection.
 * @returns The FindOptionsSelect with only the columns included in the schema.
 */
export const schemaToSelectMapper = <T>(schema: SchemaType): FindOptionsSelect<T> => {
  const { properties } = schema;

  const selection = Object.entries(properties).map(([columnName, value]) => {
    if ('properties' in value) {
      return { [columnName]: schemaToSelectMapper(value) };
    } else if ('type' in value) {
      return propertyToSelectMapper(columnName, value);
    } else if ('oneOf' in value) {
      return oneOfToSelectMapper(columnName, value);
    }

    throw new Error(`The given schema ${JSON.stringify(schema)} is invalid !`);
  });

  if (!selection) {
    throw new Error(
      'Something goes wrong during the convertion of the schema to TypeORM selection !',
    );
  }

  return selection.reduce((acc, obj) => ({ ...acc, ...obj }), {} as FindOptionsSelect<T>);
};
