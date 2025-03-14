import { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { GuestFactory, MemberFactory } from '../../../../test/factories/member.factory.js';
import { guestAccountRole } from './guestAccountRole.js';

describe('Member Account Role', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(guestAccountRole.test(req as FastifyRequest)).toBe(false);

    req.user = { account: undefined };
    expect(guestAccountRole.test(req)).toBe(false);

    const member = MemberFactory();
    member.type = AccountType.Individual;
    req.user.account = member;
    expect(guestAccountRole.test(req)).toBe(false);

    const guest = GuestFactory({ itemLoginSchema: {} });
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(guestAccountRole.test(req)).toBe(true);
  });
});
