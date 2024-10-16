import { Kind, SchemaOptions, Static, TObject, TSchema, TypeRegistry } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

interface TDiscrimineable<T extends TObject[]> extends TSchema {
  [Kind]: 'Discrimineable';
  type: 'object';
  static: { [K in keyof T]: Static<T[K]> }[number];
  oneOf: T;
  discriminator: { propertyName: string };
}

export function discrimineable<T extends TObject[]>(
  oneOf: [...T],
  propertyName?: string,
  options: SchemaOptions = {},
) {
  function DiscrimineableCheck(schema: TDiscrimineable<TObject[]>, value: unknown) {
    const reduce = schema.oneOf.reduce(
      (acc: number, schema: TObject) => (Value.Check(schema, value) ? acc + 1 : acc),
      0,
    );
    return reduce === 1;
  }
  if (!TypeRegistry.Has('Discrimineable')) {
    TypeRegistry.Set('Discrimineable', DiscrimineableCheck);
  }
  const forcedOptions = propertyName ? { discriminator: { propertyName } } : {};
  return {
    ...options,
    [Kind]: 'Discrimineable',
    type: 'object',
    oneOf,
    ...forcedOptions,
  } as TDiscrimineable<T>;
}
