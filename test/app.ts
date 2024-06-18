import { Strategy as CustomStrategy } from 'passport-custom';

import fstPassport from '@fastify/passport';
import fastify from 'fastify';

import { CompleteMember } from '@graasp/sdk';

import registerAppPlugins from '../src/app.js';
import ajvFormats from '../src/schemas/ajvFormats.js';
import { PassportStrategy } from '../src/services/auth/plugins/passport/index.js';
import { Actor } from '../src/services/member/entities/member.js';
import { saveMember } from '../src/services/member/test/fixtures/members.js';
import { DB_TEST_SCHEMA } from './constants.js';

const fastifyPassport = fstPassport.default;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const originalSessionStrategy = fastifyPassport.strategy(PassportStrategy.Session)!;
let originalStrictSessionStrategy;

/**
 * Override the session strategy to always validate the request. Set the given actor to request.user.member on authentications
 * @param actor Actor to set to request.user.member
 */
export function mockAuthenticate(actor: Actor) {
  if (!originalStrictSessionStrategy) {
    originalStrictSessionStrategy = fastifyPassport.strategy(PassportStrategy.StrictSession);
  }
  // If an actor is provided, use a custom strategy that always validate the request.
  // This will override the original session strategy to a custom one
  const strategy = new CustomStrategy((_req, done) => done(null, { member: actor }));
  fastifyPassport.use(PassportStrategy.StrictSession, strategy);
  fastifyPassport.use(PassportStrategy.Session, strategy);
}

/**
 * Set the original session strategy back.
 */
export function unmockAuthenticate() {
  fastifyPassport.use(PassportStrategy.Session, originalSessionStrategy);
  if (originalStrictSessionStrategy) {
    fastifyPassport.use(PassportStrategy.StrictSession, originalStrictSessionStrategy);
  }
}

const build = async ({ member }: { member?: CompleteMember | null } = {}) => {
  const app = fastify({
    disableRequestLogging: true,
    logger: {
      transport: {
        target: 'pino-pretty',
      },
      level: 'info',
    },
    ajv: {
      customOptions: {
        coerceTypes: 'array',
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
