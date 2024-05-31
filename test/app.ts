import { Strategy as CustomStrategy } from 'passport-custom';

import fastifyPassport from '@fastify/passport';
import fastify from 'fastify';

import { CompleteMember } from '@graasp/sdk';

import registerAppPlugins from '../src/app';
import ajvFormats from '../src/schemas/ajvFormats';
import { PassportStrategy } from '../src/services/auth/plugins/passport';
import { Actor } from '../src/services/member/entities/member';
import { saveMember } from '../src/services/member/test/fixtures/members';
import { DB_TEST_SCHEMA } from './constants';

const originalSessionStrategy = fastifyPassport.strategy(PassportStrategy.SESSION)!;
let originalStrictSessionStrategy;

/**
 * Override the session strategy to always validate the request. Set the given actor to request.user.member on authentications
 * @param actor Actor to set to request.user.member
 */
export function mockAuthenticate(actor: Actor) {
  if (!originalStrictSessionStrategy) {
    originalStrictSessionStrategy = fastifyPassport.strategy(PassportStrategy.STRICT_SESSION);
  }
  // If an actor is provided, use a custom strategy that always validate the request.
  // This will override the original session strategy to a custom one
  const strategy = new CustomStrategy((_req, done) => done(null, { member: actor }));
  fastifyPassport.use(PassportStrategy.STRICT_SESSION, strategy);
  fastifyPassport.use(PassportStrategy.SESSION, strategy);
}

/**
 * Set the original session strategy back.
 */
export function unmockAuthenticate() {
  fastifyPassport.use(PassportStrategy.SESSION, originalSessionStrategy);
  if (originalStrictSessionStrategy) {
    fastifyPassport.use(PassportStrategy.STRICT_SESSION, originalStrictSessionStrategy);
  }
}

const build = async ({ member }: { member?: CompleteMember | null } = {}) => {
  const app = fastify({
    disableRequestLogging: true,
    logger: {
      transport: {
        target: 'pino-pretty',
      },
      level: 'error',
    },
    ajv: {
      customOptions: {
        coerceTypes: 'array',
        strictTypes: false,
      },
      plugins: [ajvFormats],
    },
  });

  await registerAppPlugins(app);

  const actor: Actor = member !== null ? await saveMember(member) : undefined;
  if (actor) {
    mockAuthenticate(actor);
  } else {
    // Set the original session strategy back
    unmockAuthenticate();
  }

  return { app, actor };
};

export const clearDatabase = async (db) => {
  const entities = db.entityMetadatas;
  for (const entity of entities) {
    const repository = await db.getRepository(entity.name);
    await repository.query(
      `TRUNCATE ${DB_TEST_SCHEMA}.${entity.tableName} RESTART IDENTITY CASCADE;`,
    );
  }
};

export default build;
