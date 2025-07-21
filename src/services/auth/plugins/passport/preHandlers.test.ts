import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance, PassportUser } from 'fastify';
import Fastify from 'fastify';
import fp from 'fastify-plugin';

import { mockAuthenticate, unmockAuthenticate } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { coreApp } from '../../../../app';
import { registerDependencies } from '../../../../di/container';
import { resetDependencies } from '../../../../di/utils';
import { databasePlugin } from '../../../../plugins/database';
import { metaPlugin } from '../../../../plugins/meta';
import { openapiPlugin } from '../../../../plugins/swagger';
import { schemaRegisterPlugin } from '../../../../plugins/typebox';
import ajvFormats from '../../../../schemas/ajvFormats';
import type { MinimalMember } from '../../../../types';
import { asDefined, assertIsDefined } from '../../../../utils/assertions';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { isAuthenticated, matchOne } from './preHandlers';

// move this test closer to matchOne
// other preHandlers are tested in plugin.test.ts
describe('matchOne', () => {
  let app: FastifyInstance;
  let member: MinimalMember;
  let handler: jest.Mock;
  let preHandler: jest.Mock;
  const MOCKED_ROUTE = '/mock-route';

  function shouldNotBeCalled() {
    return () => fail('Should not be called');
  }
  function shouldBeActor(actor: MinimalMember) {
    return ({ user }: { user: PassportUser }) => expect(user.account).toEqual(actor);
  }

  beforeAll(async () => {
    resetDependencies();
    app = Fastify({
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
    await app.register(fp(openapiPlugin));
    await app.register(fp(schemaRegisterPlugin));

    // db should be registered before the dependencies.
    await app.register(fp(databasePlugin));

    // register some dependencies manually
    registerDependencies(app.log);

    await app.register(fp(metaPlugin));
    // register the core app
    app.register(fp(coreApp));

    handler = jest.fn();
    preHandler = jest.fn(async () => {});
    app.get(MOCKED_ROUTE, { preHandler: [isAuthenticated, preHandler] }, async (...args) =>
      handler(...args),
    );
  });

  afterAll(async () => {
    // await clearDatabase(app.db);
    app.close();
  });

  beforeEach(async () => {
    const { actor } = await seedFromJson();
    assertIsDefined(actor);
    mockAuthenticate(actor);
    const definedActor = asDefined(actor);
    assertIsMember(definedActor);
    member = definedActor;
  });

  afterEach(async () => {
    unmockAuthenticate();
    handler.mockClear();
  });

  it('No Whitelist', async () => {
    handler.mockImplementation(shouldBeActor(member));
    const response = await app.inject({ path: MOCKED_ROUTE });
    // console.log(await response.json());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(StatusCodes.OK);
  });

  describe('Whitelist ValidatedMember Role', () => {
    beforeEach(async () => {
      preHandler.mockImplementation(matchOne(validatedMemberAccountRole));
    });

    it('Validated MinimalMember', async () => {
      handler.mockImplementation(shouldBeActor(member));
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Unvalidated MinimalMember', async () => {
      member.isValidated = false;
      mockAuthenticate(member);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
