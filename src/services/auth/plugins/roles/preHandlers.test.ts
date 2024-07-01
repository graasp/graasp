import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase, mockAuthenticate } from '../../../../../test/app';
import { notUndefined } from '../../../../utils/assertions';
import { Actor, Member } from '../../../member/entities/member';
import { isAuthenticated } from '../passport';
import { validatedMember, whitelistRoles } from './';

// mock datasource
jest.mock('../../../../plugins/datasource');
const MOCKED_ROUTE = '/mock-route';

function shouldNotBeCalled() {
  return () => fail('Should not be called');
}
function shouldBeActor(actor: Member) {
  return ({ user }) => expect(user.member).toEqual(actor);
}

describe('Passport Plugin', () => {
  let app: FastifyInstance;
  let member: Member;
  let handler: jest.Mock;
  let preHandler: jest.Mock;
  beforeEach(async () => {
    let actor: Actor;
    ({ app, actor } = await build({}));
    member = notUndefined(actor);
    handler = jest.fn();
    preHandler = jest.fn(async () => {});
    app.get(MOCKED_ROUTE, { preHandler: [isAuthenticated, preHandler] }, async (...args) =>
      handler(...args),
    );
  });

  afterEach(async () => {
    handler.mockClear();
    await clearDatabase(app.db);
    app.close();
  });

  it('No Whitelist', async () => {
    handler.mockImplementation(shouldBeActor(member));
    const response = await app.inject({ path: MOCKED_ROUTE });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(StatusCodes.OK);
  });

  describe('Whitelist ValidatedMember Role', () => {
    beforeEach(async () => {
      preHandler.mockImplementation(whitelistRoles(validatedMember));
    });

    it('Validated Member', async () => {
      handler.mockImplementation(shouldBeActor(member));
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Unvalidated Member', async () => {
      member.isValidated = false;
      mockAuthenticate(member);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
