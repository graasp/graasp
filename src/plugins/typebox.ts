import { StringOptions, TRef, TSchema, Type, UnsafeOptions } from '@sinclair/typebox';

import { FastifyPluginAsyncTypebox, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from 'fastify';

/**
 * List of schemas to be registered in the Fastify instance.
 */
const schemas: TSchema[] = [];

/**
 * Register a schema in the Fastify instance.
 * This function needs to be called before the server starts, so the schema will be registered in the Fastify instance.
 * Each schema needs to have defined the `$id` property.
 * @param schema The schema to be registered.
 * @returns The schema passed as argument.
 */
export function registerSchemaAsRef<T extends TSchema>(schema: T): TRef<T> {
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
  Date: (options?: UnsafeOptions) =>
    Type.Unsafe<Date>({ ...options, type: 'string', format: 'date-time' }),
  UUID: (options?: StringOptions) => Type.String({ ...options, format: 'uuid' }),
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