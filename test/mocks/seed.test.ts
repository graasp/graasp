import { client } from '../../src/drizzle/db';
import { seedFromJson } from './seed';

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
    const { actor, items, itemMemberships, memberProfiles } =
      await seedFromJson({});
    expect(actor).toBeNull();
    expect(items).toHaveLength(0);
    expect(itemMemberships).toHaveLength(0);
    expect(memberProfiles).toHaveLength(0);
  });

  it('Create an account from partial info', async () => {
    const { members } = await seedFromJson({ members: [{}, {}] });

    expect(members).toBeDefined();
    expect(members[0]).toMatchObject({
      id: expect.anything(),
      name: expect.anything(),
    });
  });
});
