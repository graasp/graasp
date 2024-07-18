import { FastifyRequest } from 'fastify';

import { Member } from '../entities/member';
import { validatedMember } from './validatedMember';

describe('Validated Member', () => {
  it('Test inputs', async () => {
    const req: FastifyRequest = { user: undefined } as FastifyRequest;
    expect(validatedMember.test(req as FastifyRequest)).toBe(false);

    req.user = { member: undefined };
    expect(validatedMember.test(req)).toBe(false);

    const member = new Member();
    member.isValidated = false;
    req.user.member = member;
    expect(validatedMember.test(req)).toBe(false);

    req.user.member.isValidated = true;
    expect(validatedMember.test(req)).toBe(true);
  });
});
