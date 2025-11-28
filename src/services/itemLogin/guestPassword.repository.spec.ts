import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { guestPasswordsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { GuestPasswordRepository } from './guestPassword.repository';

const repository = new GuestPasswordRepository();

const getPasswordForGuestId = async (guestId: string) => {
  return await db.query.guestPasswordsTable.findFirst({
    where: eq(guestPasswordsTable.guestId, guestId),
  });
};

describe('Guest Password Repository', () => {
  describe('put', () => {
    it('replace existing password with new password', async () => {
      const { guests } = await seedFromJson({
        actor: null,
        items: [
          {
            itemLoginSchema: {
              guests: [
                { password: faker.internet.password() },
                { password: faker.internet.password() },
                { password: faker.internet.password() },
              ],
            },
          },
        ],
      });
      const passwords = await Promise.all(
        guests.map(async (g) => {
          const pw = await getPasswordForGuestId(g.id);
          assertIsDefined(pw);
          return pw.password;
        }),
      );

      // save new mock password
      const newPassword = 'Kp_5/6C.9PiX|Oe!u£r';
      await repository.put(db, guests[1].id, newPassword);

      // expect all other members to still have the same password
      const savedPw1 = await getPasswordForGuestId(guests[0].id);
      assertIsDefined(savedPw1);
      expect(savedPw1.password).toEqual(passwords[0]);
      const savedPw2 = await getPasswordForGuestId(guests[2].id);
      assertIsDefined(savedPw2);
      expect(savedPw2.password).toEqual(passwords[2]);

      // expect a different value to have been saved
      const savedPw = await getPasswordForGuestId(guests[1].id);
      assertIsDefined(savedPw);
      expect(savedPw.password).not.toEqual(passwords[1]);
    });
  });
});
