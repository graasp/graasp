import { faker } from '@faker-js/faker';

import { encryptPassword } from '../../utils';

const mockPassword = faker.internet.password({ prefix: '!1Aa' });

export const MOCK_PASSWORD = {
  password: mockPassword,
  hashed: encryptPassword(mockPassword),
};
