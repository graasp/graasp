import { ItemVisibilityOptionsType, ItemVisibilityType } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { client, db } from '../../../../drizzle/db';
import { itemVisibilities } from '../../../../drizzle/schema';
import { expectItem } from '../../test/fixtures/items';
import { ItemVisibilityRepository } from './repository';

const repository = new ItemVisibilityRepository();

async function saveVisibility({
  type,
  itemPath,
}: {
  type: ItemVisibilityOptionsType;
  itemPath: string;
}) {
  const res = await db.insert(itemVisibilities).values({ type, itemPath }).returning();
  return res[0];
}

describe('getManyBelowAndSelf', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('get empty', async () => {
    const {
      items: [item],
    } = await seedFromJson({ items: [{}] });
    const visibilityTypes = [ItemVisibilityType.Hidden];
    // noise should not be returned
    await saveVisibility({ type: ItemVisibilityType.Public, itemPath: item.path });

    const visibilities = await repository.getManyBelowAndSelf(db, item, visibilityTypes);

    expect(visibilities).toHaveLength(0);
  });

  it("get self's visibilities", async () => {
    const {
      items: [item],
    } = await seedFromJson({ items: [{}] });
    const visibilityTypes = [ItemVisibilityType.Hidden, ItemVisibilityType.Public];
    const visibility = await saveVisibility({
      type: ItemVisibilityType.Public,
      itemPath: item.path,
    });

    const visibilities = await repository.getManyBelowAndSelf(db, item, visibilityTypes);

    expect(visibilities).toHaveLength(1);
    expect(visibilities[0].type).toEqual(visibility.type);
    expectItem(visibilities[0].item, item);
  });

  it('get self and parents', async () => {
    const { items } = await seedFromJson({ items: [{ children: [{}, {}, {}] }] });
    const item = items[0];
    const child = items[1];
    const visibilityTypes = [ItemVisibilityType.Hidden, ItemVisibilityType.Public];

    const tag1 = await saveVisibility({ type: ItemVisibilityType.Public, itemPath: item.path });
    const tag2 = await saveVisibility({ type: ItemVisibilityType.Public, itemPath: child.path });

    const visibilities = await repository.getManyBelowAndSelf(db, item, visibilityTypes);

    expect(visibilities).toHaveLength(2);
    visibilities.forEach((t) => {
      if (tag1.id === t.id) {
        expect(t.type).toEqual(tag1.type);
        expectItem(t.item, item);
      } else if (tag2.id === t.id) {
        expect(t.type).toEqual(tag2.type);
        expectItem(t.item, child);
      } else {
        throw new Error('error in visibility');
      }
    });
  });
});
