import { faker } from '@faker-js/faker';

import { CompleteMember } from '@graasp/sdk';

import { saveMember } from '../../../../../member/test/fixtures/members';
import { MemberPassword } from '../../entities/password';
import { encryptPassword } from '../../utils';

const mockPassword = faker.internet.password({ prefix: '!1Aa' });

export const MOCK_PASSWORD = {
  password: mockPassword,
  hashed: encryptPassword(mockPassword),
};

export async function saveMemberAndPassword(
  member: CompleteMember,
  { hashed }: { hashed: string } | { hashed: Promise<string> } = MOCK_PASSWORD,
) {
  const m = await saveMember(member);
  if (hashed instanceof Promise) {
    hashed = await hashed;
  }
  await MemberPassword.save({ member: m, password: hashed });
  return m;
}
