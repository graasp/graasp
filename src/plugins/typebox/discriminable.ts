import {
  Kind,
  type SchemaOptions,
  type Static,
  type TObject,
  type TSchema,
  TypeRegistry,
} from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

interface TDiscriminable<T extends TObject[]> extends TSchema {
  [Kind]: 'Discriminable';
  type: 'object';
  static: { [K in keyof T]: Static<T[K]> }[number];
  oneOf: T;
  discriminator: { propertyName: string };
}

export function discriminable<T extends TObject[]>(
  oneOf: [...T],
  propertyName?: string,
  options: SchemaOptions = {},
) {
  function DiscriminableCheck(schema: TDiscriminable<TObject[]>, value: unknown) {
    const reduce = schema.oneOf.reduce(
      (acc: number, schema: TObject) => (Value.Check(schema, value) ? acc + 1 : acc),
      0,
    );
    return reduce === 1;
  }
  if (!TypeRegistry.Has('Discriminable')) {
    TypeRegistry.Set('Discriminable', DiscriminableCheck);
  }
  const forcedOptions = propertyName ? { discriminator: { propertyName } } : {};
  return {
    ...options,
    [Kind]: 'Discriminable',
    type: 'object',
    oneOf,
    ...forcedOptions,
  } as TDiscriminable<T>;
}
