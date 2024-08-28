import { FastifyRequest } from 'fastify';

import { AccountType } from '@graasp/sdk';

import { Member } from '../../member/entities/member';
import { Guest } from '../entities/guest';
import { guestAccountRole } from './guestAccountRole';

describe('Member Account Role', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(guestAccountRole.test(req as FastifyRequest)).toBe(false);

    req.user = { account: undefined };
    expect(guestAccountRole.test(req)).toBe(false);

    const member = new Member();
    member.type = AccountType.Individual;
    req.user.account = member;
    expect(guestAccountRole.test(req)).toBe(false);

    const guest = new Guest();
    guest.type = AccountType.Guest;
    req.user.account = guest;
    expect(guestAccountRole.test(req)).toBe(true);
  });
});