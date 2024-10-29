import {
  SchemaOptions,
  Static,
  StringOptions,
  TProperties,
  TRef,
  TSchema,
  Type,
  UnsafeOptions,
} from '@sinclair/typebox';

import { FastifyPluginAsyncTypebox, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from 'fastify';

import { MAX_ITEM_NAME_LENGTH, MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from '@graasp/sdk';

import { ITEM_NAME_REGEX } from '../schemas/regex';
import { discriminable } from './typebox/discriminable';

/**
 * List of schemas to be registered in the Fastify instance.
 */
const schemas: TSchema[] = [];

/**
 * Register a schema in the Fastify instance.
 * This function needs to be called before the server starts, so the schema will be registered in the Fastify instance.
 * Each schema needs to have a unique `$id` property.
 * @param schema The schema to be registered.
 * @param options The options for the schema.
 * @returns The schema passed as argument.
 */
export function registerSchemaAsRef<T extends TSchema>(
  id: string,
  title: string,
  schema: T,
): TRef<T> {
  // Set schema options
  schema.$id = id;
  schema.title = title;

  schemas.push(schema);
  return Type.Ref(schema);
}

/**
 * Add all schemas previously registered to the Fastify instance. This plugin needs to be registered globally.
 * @param fastify The Fastify instance.
 */
export const schemaRegisterPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  for (const schema of schemas) {
    fastify.addSchema(schema);
  }
};

/**
 * Custom types to be used in schemas.
 */
export const customType = {
  DateTime: (options?: UnsafeOptions) =>
    Type.Unsafe<Date>({ ...options, type: 'string', format: 'date-time' }),
  UUID: (options?: StringOptions) => Type.String({ ...options, format: 'uuid' }),
  Username: (options?: StringOptions) =>
    Type.String({
      ...options,
      format: 'username',
      minLength: MIN_USERNAME_LENGTH,
      maxLength: MAX_USERNAME_LENGTH,
    }),
  Nullable: <T extends TSchema & { type: string }>(schema: T) =>
    Type.Unsafe<Static<T> | null>({
      ...schema,
      type: ['null', schema.type],
    }),
  EnumString: <T extends string[]>(values: [...T], options?: SchemaOptions) =>
    Object.assign(
      /* 
      Object Assign is used so the return type contains the intersection with `{ type: 'string' }`,
      and so can be used in combination with `customType.Nullable(...)`
       */
      Type.Unsafe<`${T[number]}` | T[number]>({
        ...options,
        enum: values,
      }),
      { type: 'string' },
    ),
  Pagination: ({
    page = {},
    pageSize = {},
  }: {
    page?: { minimum?: number; maximum?: number; default?: number };
    pageSize?: { minimum?: number; maximum?: number; default?: number };
  }) =>
    Type.Object(
      {
        page: Type.Integer({
          default: 0,
          ...page,
        }),
        pageSize: Type.Integer(pageSize),
      },
      { additionalProperties: false },
    ),
  Discriminable: discriminable,
  StrictObject: <T extends TProperties>(properties: T, options?: SchemaOptions) =>
    Type.Object(properties, { ...options, additionalProperties: false }),
  ItemName: (options?: StringOptions) =>
    Type.String({
      ...options,
      minLength: 1,
      maxLength: MAX_ITEM_NAME_LENGTH,
      pattern: ITEM_NAME_REGEX,
    }),
} as const;

/**
 * Type definition for plugin options. This type is useful to be able to infer type in route handlers
 */
export type FastifyInstanceTypebox<
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends
    RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
  Logger extends FastifyBaseLogger = FastifyBaseLogger,
  TypeProvider extends TypeBoxTypeProvider = TypeBoxTypeProvider,
> = FastifyInstance<RawServer, RawRequest, RawReply, Logger, TypeProvider>;
