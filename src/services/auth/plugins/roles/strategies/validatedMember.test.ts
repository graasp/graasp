import { Member } from '../../../../member/entities/member';
import { validatedMember } from './validatedMember';

describe('Validated Member', () => {
  it('Test inputs', async () => {
    expect(validatedMember.test()).toBe(false);
    expect(validatedMember.test({ member: undefined })).toBe(false);

    const member = new Member();
    member.isValidated = false;
    expect(validatedMember.test({ member })).toBe(false);

    member.isValidated = true;
    expect(validatedMember.test({ member })).toBe(true);
  });
});
