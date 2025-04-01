import { v4 } from 'uuid';

import { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { GuestFactory, MemberFactory } from '../../../../test/factories/member.factory';
import { memberAccountRole } from './memberAccountRole';

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

    const guest = GuestFactory({ itemLoginSchemaId: v4() });
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(memberAccountRole.test(req)).toBe(false);
  });
});
