import { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { Guest } from '../../itemLogin/entities/guest';
import { Member } from '../entities/member';
import { memberAccountRole } from './memberAccountRole';

describe('Member Account Role', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(memberAccountRole.test(req as FastifyRequest)).toBe(false);

    req.user = { account: undefined };
    expect(memberAccountRole.test(req)).toBe(false);

    const member = new Member();
    member.type = AccountType.Individual;
    req.user.account = member;
    expect(memberAccountRole.test(req)).toBe(true);

    const guest = new Guest();
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(memberAccountRole.test(req)).toBe(false);
  });
});
