import { seedFromJson } from './seed';

describe('Seed', () => {
  it('Does not create an account', async () => {
    const { actor, items, itemMemberships, memberProfiles } = await seedFromJson({});
    expect(actor).toBeDefined();
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
