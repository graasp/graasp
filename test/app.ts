import { Strategy as CustomStrategy } from 'passport-custom';

import fastifyPassport from '@fastify/passport';
import { fastify } from 'fastify';

import registerAppPlugins from '../src/app';
import { resetDependencies } from '../src/di/utils';
import type { DBConnection } from '../src/drizzle/db';
import { BaseLogger } from '../src/logger';
import { modifyAjvInstance } from '../src/schemas/ajvFormats';
import { PassportStrategy } from '../src/services/auth/plugins/passport';

const originalSessionStrategy = fastifyPassport.strategy(PassportStrategy.Session)!;
let originalStrictSessionStrategy;

/**
 * Override the session strategy to always validate the request. Set the given Account to request.user.member on authentications
 * @param account Account to set to request.user.member
 */
export function mockAuthenticate<T extends { id: string; name: string; type: string }>(
  account: T | undefined,
) {
  originalStrictSessionStrategy ??= fastifyPassport.strategy(PassportStrategy.StrictSession);

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

const build = async () => {
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
      onCreate: modifyAjvInstance,
    },
  });

  await registerAppPlugins(app);

  return { app };
};

export const clearDatabase = async (_dbConnection: DBConnection) => {
  // const entities = db.entityMetadatas;
  // for (const entity of entities) {
  //   const repository = db.getRepository(entity.name);
  //   await repository.query(
  //     `TRUNCATE ${DB_TEST_SCHEMA}.${entity.tableName} RESTART IDENTITY CASCADE;`,
  //   );
  // }
};

export default build;

export const MOCK_LOGGER = {
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
} as unknown as BaseLogger;

export const MOCK_CAPTCHA = 'mockedCaptcha';
