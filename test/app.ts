import fastify from 'fastify';

import registerAppPlugins from '../src/app';
import { Member } from '../src/services/member/entities/member';
import { saveMember } from './fixtures/members';

const ACTOR = {
  name: 'actor',
  email: 'graasp@email.org',
};

const build = async ({ member }: { member?: Partial<Member> | null } = { member: ACTOR }) => {
  // const app = fastify({
  //   logger: {
  //     prettyPrint: true,
  //     level: 'debug',
  //   },
  //   ajv: {
  //     customOptions: {
  //       coerceTypes: 'array',
  //     },
  //   },
  // });

  const app = fastify({
    logger: true,
    ajv: {
      customOptions: {
        coerceTypes: 'array',
      },
    },
  });

  await registerAppPlugins(app);

  let actor: Member | null = null;
  if (member) {
    actor = await saveMember(member);
    const authenticatedActor = actor as Member;

    jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request) => {
      request.member = authenticatedActor;
    });
    jest.spyOn(app, 'fetchMemberInSession').mockImplementation(async (request) => {
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
    await repository.query(`TRUNCATE test.${entity.tableName} RESTART IDENTITY CASCADE;`);
  }
};

export default build;
