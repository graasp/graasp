import { faker } from '@faker-js/faker';

import { comparePasswords, encryptPassword } from './utils.js';

describe('Utils', () => {
  describe('comparePasswords', () => {
    it('return true if same password', async () => {
      const password = faker.internet.password();
      const hash = await encryptPassword(password);
      const result = await comparePasswords(password, hash);
      expect(result).toBe(true);
    });

    it('return false if different password', async () => {
      const password = faker.internet.password();
      const anotherPassword = faker.internet.password();
      const hash = await encryptPassword(password);
      const result = await comparePasswords(anotherPassword, hash);
      expect(result).toBe(false);
    });

    it('return false if compare without encrypting', async () => {
      const password = faker.internet.password();
      const result = await comparePasswords(password, password);
      expect(result).toBe(false);
    });
    it('success with empty string password', async () => {
      const password = '';
      const hash = await encryptPassword(password);
      const result = await comparePasswords(password, hash);
      expect(result).toBe(true);
    });
  });
});
