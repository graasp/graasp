import { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { GuestFactory, MemberFactory } from '../../../../test/factories/member.factory.js';
import { memberAccountRole } from './memberAccountRole.js';

describe('Member Account Role', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(memberAccountRole.test(req as FastifyRequest)).toBe(false);

    req.user = { account: undefined };
    expect(memberAccountRole.test(req)).toBe(false);

    const member = MemberFactory();
    member.type = AccountType.Individual;
    req.user.account = member;
    expect(memberAccountRole.test(req)).toBe(true);

    const guest = GuestFactory({});
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(memberAccountRole.test(req)).toBe(false);
  });
});
