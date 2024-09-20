import { TRef, TSchema, Type } from '@sinclair/typebox';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

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
