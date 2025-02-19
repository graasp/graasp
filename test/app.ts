import { Strategy as CustomStrategy } from 'passport-custom';
import { DataSource } from 'typeorm';

import fastifyPassport from '@fastify/passport';
import { fastify } from 'fastify';

import { CompleteMember } from '@graasp/sdk';

import registerAppPlugins from '../src/app';
import { resetDependencies } from '../src/di/utils';
import { db } from '../src/drizzle/db';
import { BaseLogger } from '../src/logger';
import ajvFormats from '../src/schemas/ajvFormats';
import { Account } from '../src/services/account/entities/account';
import { PassportStrategy } from '../src/services/auth/plugins/passport';
import { Member } from '../src/services/member/entities/member';
import { saveMember } from '../src/services/member/test/fixtures/members';
import { DB_TEST_SCHEMA } from './constants';

const originalSessionStrategy = fastifyPassport.strategy(PassportStrategy.Session)!;
let originalStrictSessionStrategy;

/**
 * Override the session strategy to always validate the request. Set the given Account to request.user.member on authentications
 * @param account Account to set to request.user.member
 */
export function mockAuthenticate(account: Account | undefined) {
  if (!originalStrictSessionStrategy) {
    originalStrictSessionStrategy = fastifyPassport.strategy(PassportStrategy.StrictSession);
  }
  // If an account is provided, use a custom strategy that always validate the request.
  // This will override the original session strategy to a custom one
  const strategy = new CustomStrategy((_req, done) => done(null, { account }));
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
  // Reset dependencies before each test to ensure
  // having new singleton instances in every tests.
  resetDependencies();

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
        discriminator: true,
        allowUnionTypes: true,
      },
      plugins: [ajvFormats],
    },
  });

  await registerAppPlugins(app);

  // TODO: find out how to clear the DB in drizzle
  // drop all the database and synchronize schemas
  // await db.(true);

  const savedMember: Member | undefined = member !== null ? await saveMember(member) : undefined;
  if (savedMember) {
    mockAuthenticate(savedMember);
  } else {
    // Set the original session strategy back
    unmockAuthenticate();
  }

  return { app, actor: savedMember };
};

export const clearDatabase = async (db: DataSource) => {
  const entities = db.entityMetadatas;
  for (const entity of entities) {
    const repository = db.getRepository(entity.name);
    await repository.query(
      `TRUNCATE ${DB_TEST_SCHEMA}.${entity.tableName} RESTART IDENTITY CASCADE;`,
    );
  }
};

export default build;

export const MOCK_LOGGER = {
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as BaseLogger;
