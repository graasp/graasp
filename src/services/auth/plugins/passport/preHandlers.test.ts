import { StatusCodes } from 'http-status-codes';

import { FastifyInstance, PassportUser } from 'fastify';

import build, { mockAuthenticate, unmockAuthenticate } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { MinimalMember } from '../../../../types';
import { asDefined, assertIsDefined } from '../../../../utils/assertions';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { isAuthenticated, matchOne } from './preHandlers';

// move this test closer to matchone
// other prehandlers are tested in plugin.test.ts
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
    ({ app } = await build());

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
