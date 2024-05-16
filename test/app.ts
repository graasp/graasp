import fastify from 'fastify';

import { CompleteMember } from '@graasp/sdk';

import registerAppPlugins from '../src/app';
import ajvFormats from '../src/schemas/ajvFormats';
import { Actor } from '../src/services/member/entities/member';
import { saveMember } from '../src/services/member/test/fixtures/members';
import { DB_TEST_SCHEMA } from './constants';

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
    const authenticatedActor = actor;

    jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request) => {
      request.member = authenticatedActor;
    });
    jest.spyOn(app, 'attemptVerifyAuthentication').mockImplementation(async (request) => {
      request.session.set('member', authenticatedActor.id);
      request.member = authenticatedActor;
    });
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
