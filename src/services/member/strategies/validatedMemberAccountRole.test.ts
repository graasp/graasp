import { v4 } from 'uuid';

import type { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { GuestFactory, MemberFactory } from '../../../../test/factories/member.factory';
import { validatedMemberAccountRole } from './validatedMemberAccountRole';

describe('Validated Member', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(validatedMemberAccountRole.test(req as FastifyRequest)).toBe(false);

    req.user = { account: undefined };
    expect(validatedMemberAccountRole.test(req)).toBe(false);

    const member = MemberFactory({ id: v4() });
    member.type = AccountType.Individual;
    member.isValidated = false;
    req.user.account = member;
    expect(validatedMemberAccountRole.test(req)).toBe(false);

    member.isValidated = true;
    expect(validatedMemberAccountRole.test(req)).toBe(true);

    const guest = GuestFactory({ itemLoginSchemaId: v4() });
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(validatedMemberAccountRole.test(req)).toBe(false);
  });
});
