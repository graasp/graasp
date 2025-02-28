import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import { client } from '../../src/drizzle/db';
import { seed } from './seed.drizzle';

describe('Seed', () => {
  beforeAll(async () => {
    // connect to Database
    await client.connect();
  });
  afterAll(async () => {
    // close connection to db
    await client.end();
  });

  it('Does not create an account', async () => {
    const { accountsTable, itemsRaw } = await seed({
      accountsTable: [],
      itemsRaw: [],
    });
    expect(accountsTable).toHaveLength(0);
    expect(itemsRaw).toHaveLength(0);
  });

  it('Create an account from partial info', async () => {
    const bobId = v4();
    const { accountsTable, itemsRaw } = await seed({
      accountsTable: [
        {
          id: bobId,
          name: faker.person.firstName(),
          email: faker.internet.email(),
        },
      ],
      itemsRaw: [],
    });
    expect(accountsTable).toBeDefined();
    expect(accountsTable[0]).toMatchObject({
      id: expect.anything(),
      name: expect.anything(),
    });
    expect(itemsRaw).toHaveLength(0);
  });
});
