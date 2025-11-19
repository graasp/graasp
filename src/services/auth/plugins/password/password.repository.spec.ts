import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { memberPasswordsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { MemberPasswordRepository } from './password.repository';

const repository = new MemberPasswordRepository();

const getPasswordForMemberId = async (memberId: string) => {
  return await db.query.memberPasswordsTable.findFirst({
    where: eq(memberPasswordsTable.memberId, memberId),
  });
};

describe('Member Password Repository', () => {
  describe('put', () => {
    it('replace existing password with new password', async () => {
      const { members } = await seedFromJson({ actor: null, members: [{}, {}, {}] });
      const passwords = (
        await db
          .insert(memberPasswordsTable)
          .values(members.map((m) => ({ password: faker.internet.password(), memberId: m.id })))
          .returning()
      ).map(({ password }) => password);
      const initialPw = await getPasswordForMemberId(members[1].id);
      assertIsDefined(initialPw);
      expect(initialPw.password).toEqual(passwords[1]);

      // save new mock password
      const newPassword = 'Kp_5/6C.9PiX|Oe!u£r';
      await repository.put(db, members[1].id, newPassword);

      // expect all other members to still have the same password
      const savedPw1 = await getPasswordForMemberId(members[0].id);
      assertIsDefined(savedPw1);
      expect(savedPw1.password).toEqual(passwords[0]);
      const savedPw2 = await getPasswordForMemberId(members[2].id);
      assertIsDefined(savedPw2);
      expect(savedPw2.password).toEqual(passwords[2]);

      // expect a different value to have been saved
      const savedPw = await getPasswordForMemberId(members[1].id);
      assertIsDefined(savedPw);
      expect(savedPw.password).not.toEqual(passwords[1]);
    });
  });
});
