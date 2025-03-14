// This import is necessary so we only download needed langage. eslint can't find the import because it's dynamic.
// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker/locale/en';
import { eq } from 'drizzle-orm/sql';
import { In } from 'typeorm';
import { v4 } from 'uuid';

import {
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import { ItemFactory } from '../../../test/factories/item.factory.js';
import { buildFile, seedFromJson } from '../../../test/mocks/seed.js';
import { db } from '../../drizzle/db.js';
import { itemsRaw, publishedItems, recycledItemDatas } from '../../drizzle/schema.js';
import { Item } from '../../drizzle/types.js';
import { assertIsDefined } from '../../utils/assertions.js';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  TooManyDescendants,
} from '../../utils/errors.js';
import { expectMember } from '../member/test/fixtures/members.js';
import { ItemPublishedRepository } from './plugins/publication/published/itemPublished.repository.js';
import { RecycledItemDataRepository } from './plugins/recycled/repository.js';
import { ItemRepository } from './repository.js';
import { expectItem, expectManyItems } from './test/fixtures/items.js';

const alphabeticalOrder = (a: string, b: string) => a.localeCompare(b);

// TODO: remove when this can be handled by the seed
async function saveRecycledItem(item: Item, creatorId: string) {
  await db.insert(recycledItemDatas).values({ itemPath: item.path, creatorId });
  await db
    .update(itemsRaw)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(itemsRaw.id, item.id));
}

// TODO: remove when this can be handled by the seed
const saveCollections = async () => {
  const {
    items,
    members: [member],
  } = await seedFromJson({
    actor: null,
    items: [
      {
        isPublic: true,
        creator: { name: 'bob' },
        memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
      },
      {
        isPublic: true,
        creator: { name: 'bob' },
        memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
      },
      {
        isPublic: true,
        creator: { name: 'bob' },
        memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
      },
    ],
  });

  for (const item of items) {
    await db.insert(publishedItems).values({ item, creator: member });
  }
  return { items, member };
};

// TODO: remove when this when we use drizzle
const getOrderForItemId = async (
  rawItemRepository: ItemRepository,
  itemId: Item['id'],
): Promise<number | null> => {
  const order = (await rawItemRepository
    .createQueryBuilder('item')
    .select('item."order"')
    .where(`id = '${itemId}'`)
    // needs to get raw otherwise we cannot get null order
    .getRawOne<{ order: string }>())!.order;
  // return null value
  // TODO: check returns null
  if (!order) {
    return order as unknown as null;
  }
  // return float order
  return parseFloat(order);
};

describe('ItemRepository', () => {
  let itemRawRepository: ItemRepository;
  let rawItemPublishedRepository: ItemPublishedRepository;
  let itemRepository: ItemRepository;
  let recycledItemRepository: RecycledItemDataRepository;

  beforeAll(async () => {
    await client.connect();
    itemRawRepository = db.getRepository(Item);
    rawItemPublishedRepository = db.getRepository(ItemPublished);
    itemRepository = new ItemRepository(db.manager);
    recycledItemRepository = new RecycledItemDataRepository(db.manager);
  });

  afterAll(async () => {
    await client.end();
  });

  describe('checkHierarchyDepth', () => {
    it('depth is acceptable', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      expect(itemRepository.checkHierarchyDepth(item)).toBeUndefined();
    });
    it('depth is acceptable with additional levels', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      expect(itemRepository.checkHierarchyDepth(item, 4)).toBeUndefined();
    });
    it('throw for deep item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });
      try {
        itemRepository.checkHierarchyDepth(item, MAX_TREE_LEVELS);
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeInstanceOf(HierarchyTooDeep);
      }
    });
  });

  describe('checkNumberOfDescendants', () => {
    it('descendants is acceptable', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      expect(await itemRepository.checkNumberOfDescendants(item, 10)).toBeUndefined();
    });
    it('throws because item is too deep', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{ children: [{ children: [{}, {}] }] }] });

      await expect(itemRepository.checkNumberOfDescendants(item, 2)).rejects.toBeInstanceOf(
        TooManyDescendants,
      );
    });
    it('throw for deep item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      try {
        await itemRepository.checkNumberOfDescendants(item, 0);
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeInstanceOf(TooManyDescendants);
      }
    });
  });
  describe('createOne', () => {
    it('create default folder item', async () => {
      const {
        members: [creator],
      } = await seedFromJson({ actor: null, members: [{ extra: { lang: 'en' } }] });
      const item = itemRepository.createOne({ name: 'name', creator });
      expect(item.path).not.toContain('.');
      expect(item.name).toEqual('name');
      expect(item.lang).toEqual('en');
      expect(item.description).toEqual(null);
      expect(item.type).toEqual(ItemType.FOLDER);
      expect(item.creator!.id).toEqual(creator.id);
      expect(item.extra).toEqual({ folder: {} });
    });
    it('create default document item', async () => {
      const {
        members: [creator],
      } = await seedFromJson({ actor: null, members: [{}] });
      const item = itemRepository.createOne({
        type: ItemType.DOCUMENT,
        name: 'name',
        description: 'description',
        creator,
        extra: { document: { content: '' } },
        lang: 'fr',
      });
      expect(item.path).not.toContain('.');
      expect(item.name).toEqual('name');
      expect(item.description).toEqual('description');
      expect(item.type).toEqual(ItemType.DOCUMENT);
      expect(item.lang).toEqual('fr');
      expect(item.creator!.id).toEqual(creator.id);
      expect(item.extra).toEqual({ document: { content: '' } });
    });
    it('create child item', async () => {
      const {
        items: [parentItem],
        members: [creator],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });
      const item = itemRepository.createOne({
        name: 'name',
        creator,
        parent: parentItem,
      });
      expect(item.path).toContain(parentItem.path);
      expect(item.name).toEqual('name');
      expect(item.description).toEqual(null);
      expect(item.type).toEqual(ItemType.FOLDER);
      expect(item.creator!.id).toEqual(creator.id);
    });
  });
  describe('deleteMany', () => {
    it('delete successfully', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await itemRepository.delete([item.id]);
      expect(await itemRawRepository.findOneBy({ id: item.id })).toBeNull();
    });
    it('delete non existant ids does not throw', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await itemRepository.delete([v4()]);
      expect(await itemRawRepository.countBy({ id: item.id })).toEqual(1);
    });
    it('delete many ids', async () => {
      const {
        items: [item1, item2, item3],
      } = await seedFromJson({ actor: null, items: [{}, {}, { name: 'noise' }] });

      await itemRepository.delete([item1.id, item2.id]);
      expect(await itemRawRepository.findOneBy({ id: item1.id })).toBeNull();
      expect(await itemRawRepository.findOneBy({ id: item2.id })).toBeNull();
      expect(await itemRawRepository.countBy({ id: item3.id })).toEqual(1);
    });
  });
  describe('get', () => {
    it('getOne item successfully', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ creator: 'actor' }] });
      assertIsDefined(actor);
      assertIsMember(actor);
      const result = await itemRepository.getOne(item.id);
      expectItem(result, item);
      // contains creator
      expectMember(result?.creator, actor);
    });
    it('getOrThrow item successfully', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ creator: 'actor' }] });
      assertIsDefined(actor);
      assertIsMember(actor);
      const result = await itemRepository.getOneOrThrow(item.id);
      expectItem(result, item);
      // contains creator
      expectMember(result.creator, actor);
    });
    it('getOne returns null for a non-existent id', async () => {
      const id = v4();
      expect(await itemRepository.getOne(id)).toBeNull();
    });
    it('getOneOrThrow throws ItemNotFound for a non-existent id', async () => {
      const id = v4();
      expect(async () => await itemRepository.getOneOrThrow(id)).rejects.toMatchObject(
        new ItemNotFound(id),
      );
    });
  });
  describe('getAncestors', () => {
    it('Returns successfully in order', async () => {
      const {
        items: [parent, child1, childOfChild],
      } = await seedFromJson({ items: [{ children: [{ children: [{}] }, { name: 'noise' }] }] });

      const parents = [parent, child1];

      // patch item to force reorder
      await itemRepository.updateOne(parent.id, { name: 'newname' });
      parent.name = 'newname';

      const data = await itemRepository.getAncestors(childOfChild);
      expect(data).toHaveLength(parents.length);
      data.forEach((p, idx) => {
        expectItem(p, parents[idx]);
      });
    });
    it('Returns successfully empty parents', async () => {
      const {
        items: [parent],
      } = await seedFromJson({
        items: [
          {},
          // noise
          { children: [{ children: [{}] }] },
        ],
      });

      const data = await itemRepository.getAncestors(parent);

      expect(data).toEqual([]);
    });
  });
  describe('getChildren', () => {
    it('Returns successfully', async () => {
      const {
        actor,
        items: [parentItem, child1, _childOfChild, child2],
      } = await seedFromJson({ items: [{ children: [{ children: [{}] }, {}] }] });

      const children = [child1, child2];

      const data = await itemRepository.getChildren(actor, parentItem);
      expect(data).toHaveLength(children.length);
      expectManyItems(data, children);
    });
    it('Returns successfully empty children', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({ items: [{}] });

      const response = await itemRepository.getChildren(actor, parent);

      expect(response).toEqual([]);
    });

    it('Returns ordered children', async () => {
      const {
        actor,
        items: [parent, child1, child2],
      } = await seedFromJson({ items: [{ children: [{ order: 2 }, { order: 1 }] }] });

      const childrenInOrder = [child2, child1];
      const children = [child1, child2];

      const data = await itemRepository.getChildren(actor, parent, { ordered: true });
      expect(data).toHaveLength(children.length);
      // verify order and content
      childrenInOrder.forEach((child, idx) => {
        const resultChild = data[idx];
        expectItem(resultChild, child);
      });
    });

    it('Filter children by Folder', async () => {
      const {
        actor,
        items: [parent, notAFolder, child2],
      } = await seedFromJson({
        items: [{ children: [{ type: ItemType.DOCUMENT }, { type: ItemType.FOLDER }] }],
      });

      const children = [child2];

      const data = await itemRepository.getChildren(actor, parent, { types: [ItemType.FOLDER] });
      expect(data).toHaveLength(children.length);
      children.forEach(({ id }, idx) => {
        expectItem(
          data.find(({ id: thisId }) => thisId === id),
          // cannot use packed item because member != actor
          children.find(({ id: thisId }) => thisId === id),
        );
        expect(() => expectItem(data[idx], notAFolder)).toThrow(Error);
      });
    });

    it('Filter children by keyword', async () => {
      const {
        actor,
        items: [parent, child1, child2, _noise],
      } = await seedFromJson({
        items: [{ children: [{ name: 'child1' }, { name: 'child2' }, { name: 'name' }] }],
      });
      const children = [child1, child2];

      const data = await itemRepository.getChildren(actor, parent, {
        keywords: ['child'],
      });
      expect(data).toHaveLength(children.length);
      expectManyItems(data, children);
    });

    it('returns error without leaking information', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.DOCUMENT }],
      });

      await expect(itemRepository.getChildren(actor, item)).rejects.toMatchObject(
        new ItemNotFolder({ id: item.id }),
      );
    });
  });
  describe('getDescendants', () => {
    it('Returns successfully', async () => {
      const {
        items: [parent, child1, child2, childOfChild2],
      } = await seedFromJson({
        items: [{ children: [{ name: 'child1' }, { name: 'child2', children: [{}] }] }],
      });

      const descendants = [child1, child2, childOfChild2];

      const data = await itemRepository.getDescendants(parent as FolderItem);
      expect(data).toHaveLength(descendants.length);
      expectManyItems(data, descendants);
    });

    it('Returns successfully ordered', async () => {
      const {
        items: [parent, child1, childOfChild1, anotherChildOfChild1, child2, childOfChild2],
      } = await seedFromJson({
        items: [
          {
            children: [
              { name: 'child1', order: 3, children: [{ order: 2 }, { order: 1 }] },
              { name: 'child2', order: 2, children: [{}] },
            ],
          },
        ],
      });

      const descendants = [child2, childOfChild2, child1, anotherChildOfChild1, childOfChild1];
      const data = await itemRepository.getDescendants(parent as FolderItem, { ordered: true });
      expectManyItems(data, descendants);
      descendants.forEach((v, idx) => {
        expectItem(data[idx], v);
      });
    });

    it('Returns successfully empty descendants', async () => {
      const {
        items: [parent],
      } = await seedFromJson({
        items: [
          {},
          //noise
          {
            children: [{ children: [{}, {}] }, { children: [{}] }],
          },
        ],
      });

      const response = await itemRepository.getDescendants(parent as FolderItem);

      expect(response).toEqual([]);
    });
  });
  describe('getManyDescendants', () => {
    it('return empty for empty ids', async () => {
      const result = await itemRepository.getManyDescendants([]);
      expect(result).toHaveLength(0);
    });
    it('return many descendants', async () => {
      const {
        actor,
        items: [A, A1, A11, B, B1, B11, B12, deleted, _C, _C1],
      } = await seedFromJson({
        items: [
          {
            children: [{ children: [{}] }],
          },
          {
            children: [{ children: [{}, {}, {}] }],
          },
          {
            children: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);
      // TODO: remove once deleted is part of seed
      await saveRecycledItem(recycledItemRepository, itemRawRepository, deleted, actor.id);

      const result = await itemRepository.getManyDescendants([A, B]);

      expectManyItems(result, [A1, A11, B1, B11, B12]);
      expect(result).not.toContain(deleted);
    });
    it('return descendants with deleted', async () => {
      const {
        actor,
        items: [A, A1, A11, B, B1, B11, B12, deleted, _C, _C1],
      } = await seedFromJson({
        items: [
          {
            children: [{ children: [{}] }],
          },
          {
            children: [{ children: [{}, {}, {}] }],
          },
          {
            children: [{}],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);
      // TODO: remove once deleted is part of seed
      await saveRecycledItem(recycledItemRepository, itemRawRepository, deleted, actor.id);

      const result = await itemRepository.getManyDescendants([A, B], {
        withDeleted: true,
      });

      expectManyItems(result, [A1, A11, B1, B11, B12, deleted]);
    });
  });
  describe('getMany', () => {
    it('return empty for empty ids', async () => {
      const result = await itemRepository.getMany([]);
      expect(Object.keys(result.data)).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
    it('return result for ids with errors', async () => {
      const {
        items: [item1, item2, item3],
      } = await seedFromJson({ actor: null, items: [{}, {}, {}] });

      const result = await itemRepository.getMany([item1.id, item2.id, item3.id, v4()]);
      expectItem(result.data[item1.id], item1);
      expectItem(result.data[item2.id], item2);
      expectItem(result.data[item3.id], item3);
      expect(result.errors).toHaveLength(1);
    });
    it('return result for ids with deleted', async () => {
      const {
        actor,
        items: [item1, item2, item3],
      } = await seedFromJson({
        items: [{}, {}, {}],
      });
      assertIsDefined(actor);
      assertIsMember(actor);
      // TODO: remove once deleted is part of seed
      await saveRecycledItem(recycledItemRepository, itemRawRepository, item3, actor.id);

      const result = await itemRepository.getMany([item1.id, item2.id, item3.id, v4()], {
        withDeleted: true,
      });
      expectItem(result.data[item1.id], item1);
      expectItem(result.data[item2.id], item2);
      expectItem(result.data[item3.id], item3);
      expect(result.errors).toHaveLength(1);
    });
    it('throw for error', async () => {
      await expect(itemRepository.getMany([v4()], { throwOnError: true })).rejects.toBeInstanceOf(
        ItemNotFound,
      );
    });
  });
  describe('getNumberOfLevelsToFarthestChild', () => {
    it('return correct number', async () => {
      const {
        items: [item, child],
      } = await seedFromJson({
        actor: null,
        items: [{ children: [{}] }],
      });
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(item)).toEqual(2);
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(child)).toEqual(0);
    });
  });
  describe('move', () => {
    it('move item to root', async () => {
      const {
        items: [_parent, child],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            children: [{}],
          },
        ],
      });

      expect((await itemRepository.move(child)).id).toEqual(child.id);
      const newItem = await itemRawRepository.findOneBy({ id: child.id });
      expect(newItem!.path).toEqual(buildPathFromIds(child.id));
    });
    it('move item into parent', async () => {
      const {
        items: [item1, item2],
      } = await seedFromJson({ actor: null, items: [{}, {}] });

      expect((await itemRepository.move(item1, item2)).id).toEqual(item1.id);
      const newItem = await itemRawRepository.findOneBy({ id: item1.id });
      expect(newItem!.path).toEqual(buildPathFromIds(item2.id, item1.id));
    });
    it('Fail to move items in non-folder parent', async () => {
      const {
        items: [item1, item2],
      } = await seedFromJson({ actor: null, items: [{}, { type: ItemType.DOCUMENT }] });

      await expect(itemRepository.move(item1, item2)).rejects.toBeInstanceOf(ItemNotFolder);
    });
    it('Fail to move into self', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await expect(itemRepository.move(item, item)).rejects.toBeInstanceOf(InvalidMoveTarget);
    });
    it('Fail to move in same parent', async () => {
      // root
      const {
        items: [parent, child],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            children: [{}],
          },
        ],
      });
      await expect(itemRepository.move(parent)).rejects.toBeInstanceOf(InvalidMoveTarget);

      await expect(itemRepository.move(child, parent)).rejects.toBeInstanceOf(InvalidMoveTarget);
    });
  });

  describe('patch', () => {
    it('patch successfully', async () => {
      const {
        items: [item, noise],
      } = await seedFromJson({
        actor: null,
        items: [{ lang: 'fr' }, { name: 'noise' }],
      });

      const newData = { lang: 'de', name: 'newname' };
      const newItem = await itemRepository.updateOne(item.id, newData);
      expectItem(newItem, { ...item, ...newData });
      expectItem(await itemRawRepository.findOneBy({ id: item.id }), {
        ...item,
        ...newData,
      });
      expectItem(await itemRawRepository.findOneBy({ id: noise.id }), noise);
    });
    it('patch extra successfully', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            type: ItemType.S3_FILE,
            extra: {
              [ItemType.S3_FILE]: {
                content: 'prop',
                name: 'name',
                path: 'path',
                mimetype: 'mime',
                size: 30,
              },
            },
          },
          { name: 'noise' },
        ],
      });

      const newData = {
        // correct data
        [ItemType.S3_FILE]: {
          content: 'hello',
        },
        // incorrect data
        document: { content: 'some content' },
      };
      const newItem = await itemRepository.updateOne(item.id, { extra: newData });
      expectItem(newItem, {
        ...item,
        extra: {
          [ItemType.S3_FILE]: {
            content: 'hello',
            name: 'name',
            path: 'path',
            mimetype: 'mime',
            size: 30,
          },
        },
      });
      expectItem(await itemRawRepository.findOneBy({ id: item.id }), {
        ...item,
        extra: {
          [ItemType.S3_FILE]: {
            content: 'hello',
            name: 'name',
            path: 'path',
            mimetype: 'mime',
            size: 30,
          },
        },
      });
    });
    it('patch settings successfully', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [{ settings: { isCollapsible: true } }],
      });
      const newData = {
        settings: {
          hasThumbnail: true,
        },
      };
      const newItem = await itemRepository.updateOne(item.id, newData);
      expectItem(newItem, { ...item, settings: { hasThumbnail: true, isCollapsible: true } });
      expectItem(await itemRawRepository.findOneBy({ id: item.id }), {
        ...item,
        settings: { hasThumbnail: true, isCollapsible: true },
      });
    });
  });

  describe('post', () => {
    it('post successfully', async () => {
      const {
        members: [member],
      } = await seedFromJson({ actor: null, members: [{}] });
      const data = { name: 'name', type: ItemType.FOLDER };

      await itemRepository.addOne({ item: data, creator: member });
      const newItem = await itemRawRepository.findOne({
        where: { name: data.name },
        relations: { creator: true },
      });
      expect(newItem!.name).toEqual(data.name);
      expect(newItem!.type).toEqual(data.type);
      expect(newItem!.creator!.id).toEqual(member.id);
    });
    it('post successfully with parent item', async () => {
      const {
        members: [member],
        items: [parentItem],
      } = await seedFromJson({ members: [{}], items: [{}] });
      const data = { name: 'name-1', type: ItemType.S3_FILE };

      await itemRepository.addOne({ item: data, creator: member, parentItem });
      const newItem = await itemRawRepository.findOne({
        where: { name: data.name },
        relations: { creator: true },
      });
      expect(newItem!.name).toEqual(data.name);
      expect(newItem!.type).toEqual(data.type);
      expect(newItem!.path).toContain(parentItem.path);
      expect(newItem!.creator!.id).toEqual(member.id);
    });
  });

  describe('postMany', () => {
    it('post many', async () => {
      const {
        members: [member],
      } = await seedFromJson({ actor: null, members: [{}] });
      const items = Array.from(
        { length: 15 },
        (_v, idx) =>
          ItemFactory({ id: `item${idx}`, type: ItemType.FOLDER, creator: member }) as Item,
      );

      const insertedItems = await itemRepository.addMany(items, member);
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creator?.id);

      const itemsInDB = await db.query.items.firstMany({
        where: inArray(itemsRaw.id, insertedItemNames),
        with: { creator: true },
      });
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creator?.id);
      const itemPathsInDb = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemNames.sort(alphabeticalOrder),
      );
      expect(itemTypesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemTypes.sort(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemCreatorIds.sort(alphabeticalOrder),
      );
      expect(itemPathsInDb.every((path) => !path.includes('.'))).toBeTruthy();
    });
    it('post many with parent item', async () => {
      const {
        members: [member],
        items: [parentItem],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });

      const items = Array.from(
        { length: 15 },
        (_v, idx) =>
          ItemFactory({ name: `item${idx}`, type: ItemType.FOLDER, creator: member }) as Item,
      );

      const insertedItems = await itemRepository.addMany(items, member, parentItem);
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creator?.id);
      const insertedItemPaths = insertedItems.map((i) => i.path);

      const itemsInDB = await itemRawRepository.find({
        where: { name: In(insertedItemNames) },
        relations: { creator: true },
      });
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creator?.id);
      const itemPathsInDB = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemNames.sort(alphabeticalOrder),
      );
      expect(itemTypesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemTypes.sort(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemCreatorIds.sort(alphabeticalOrder),
      );
      expect(itemPathsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemPaths.sort(alphabeticalOrder),
      );
      expect(itemPathsInDB.every((path) => path.includes(`${parentItem.path}.`))).toBeTruthy();
    });
  });
  describe('postMany', () => {
    it('post many', async () => {
      const items = Array.from(
        { length: 15 },
        (_v, idx) =>
          ItemFactory({ id: `item${idx}`, type: ItemType.FOLDER, creator: actor }) as Item,
      );

      const insertedItems = await itemRepository.addMany(items, actor);
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creator?.id);

      const itemsInDB = await testUtils.rawItemRepository.find({
        where: { name: In(insertedItemNames) },
        relations: { creator: true },
      });
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creator?.id);
      const itemPathsInDb = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemNames.sort(alphabeticalOrder),
      );
      expect(itemTypesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemTypes.sort(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemCreatorIds.sort(alphabeticalOrder),
      );
      expect(itemPathsInDb.every((path) => !path.includes('.'))).toBeTruthy();
    });
    it('post many with parent item', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const items = Array.from(
        { length: 15 },
        (_v, idx) =>
          ItemFactory({ name: `item${idx}`, type: ItemType.FOLDER, creator: actor }) as Item,
      );

      const insertedItems = await itemRepository.addMany(items, actor, parentItem);
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creator?.id);
      const insertedItemPaths = insertedItems.map((i) => i.path);

      const itemsInDB = await testUtils.rawItemRepository.find({
        where: { name: In(insertedItemNames) },
        relations: { creator: true },
      });
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creator?.id);
      const itemPathsInDB = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemNames.sort(alphabeticalOrder),
      );
      expect(itemTypesInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemTypes.sort(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemCreatorIds.sort(alphabeticalOrder),
      );
      expect(itemPathsInDB.sort(alphabeticalOrder)).toEqual(
        insertedItemPaths.sort(alphabeticalOrder),
      );
      expect(itemPathsInDB.every((path) => path.includes(`${parentItem.path}.`))).toBeTruthy();
    });
  });
  describe('copy', () => {
    it('copy successfully', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });
      const result = await itemRepository.copy(item, member, [item.name]);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
    });
    it('copy successfully in parent', async () => {
      const {
        members: [member],
        items: [originalParentItem, item, parentItem],
      } = await seedFromJson({ actor: null, members: [{}], items: [{ children: [{}] }, {}] });

      const result = await itemRepository.copy(item, member, [item.name], parentItem);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(copy.path).toContain(parentItem.path);
      expect(copy.path).not.toContain(originalParentItem.path);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
    });
    // regression test for issue with statefull regular expression
    it('copy multiple times', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });

      const result = await itemRepository.copy(item, member, [item.name]);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
      const secondResult = await itemRepository.copy(copy, member, [item.name, copy.name]);
      const secondCopy = secondResult.copyRoot;
      expect(secondCopy.name).toEqual(`${item.name} (3)`);
      const thirdResult = await itemRepository.copy(secondCopy, member, [
        item.name,
        copy.name,
        secondCopy.name,
      ]);
      const thirdCopy = thirdResult.copyRoot;
      expect(thirdCopy.name).toEqual(`${item.name} (4)`);
    });
    it('cannot copy in non-folder', async () => {
      const {
        members: [member],
        items: [item, parentItem],
      } = await seedFromJson({
        actor: null,
        members: [{}],
        items: [{}, { type: ItemType.DOCUMENT }],
      });
      await expect(itemRepository.copy(item, member, [], parentItem)).rejects.toBeInstanceOf(
        ItemNotFolder,
      );
    });
    it('copy suffix is updated', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({
        actor: null,
        members: [{}],
        items: [{}],
      });

      const result = await itemRepository.copy(item, member, [item.name]);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(copy, member, [item.name, copy.name]);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name} (3)`);
    });

    it('copy name is not altered', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({
        actor: null,
        members: [{}],
        items: [{}],
      });

      item.name = '()(/\\)(..)() (a) (3) ';
      await itemRepository.updateOne(item.id, item);
      const result = await itemRepository.copy(item, member, [item.name]);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(copy, member, [item.name, copy.name]);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name} (3)`);
    });

    it('copy name do not exceed maximum length allowed.', async () => {
      const {
        members: [member],
        items: [item],
      } = await seedFromJson({
        actor: null,
        members: [{}],
        items: [{}],
      });

      item.name = faker.string.sample(MAX_ITEM_NAME_LENGTH);
      await itemRepository.updateOne(item.id, item);
      const result = await itemRepository.copy(item, member, [item.name]);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (2)`);

      copy.name = `${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (9)`;
      await itemRepository.updateOne(copy.id, copy);
      const result2 = await itemRepository.copy(copy, member, [item.name, copy.name]);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 5)} (10)`);
    });
  });
  describe('getItemSumSize', () => {
    const itemType = ItemType.S3_FILE;
    it('get sum for no item', async () => {
      const {
        members: [member],
      } = await seedFromJson({
        actor: null,
        members: [{}],
      });
      const result = await itemRepository.getItemSumSize(member.id, itemType);
      expect(result).toEqual(0);
    });
    it('get sum for many items', async () => {
      const {
        actor,
        items: [item1, item2, item3],
      } = await seedFromJson({
        items: [buildFile('actor'), buildFile('actor'), buildFile('actor'), { name: 'noise' }],
      });
      assertIsDefined(actor);
      assertIsMember(actor);

      const result = await itemRepository.getItemSumSize(actor.id, itemType);
      expect(result).toEqual(
        item1.extra[itemType].size + item2.extra[itemType].size + item3.extra[itemType].size,
      );
    });
  });
  describe('getAllPublishedItems', () => {
    it('get published items', async () => {
      // TODO: update when seed handle published items
      const { items } = await saveCollections(rawItemPublishedRepository);
      const result = await itemRepository.getAllPublishedItems();
      expectManyItems(result, items);
    });
  });
  describe('getPublishedItemsForMember', () => {
    it('get published items for member', async () => {
      // TODO: update when seed handle published items
      const { items, member } = await saveCollections(rawItemPublishedRepository);
      // noise
      await saveCollections(rawItemPublishedRepository);

      const result = await itemRepository.getPublishedItemsForMember(member.id);
      expectManyItems(result, items);
    });
  });
  describe('getNextOrderCount', () => {
    it('return default value for no children', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ members: [{}], items: [{}] });
      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(DEFAULT_ORDER);
    });
    it('no parent returns null', async () => {
      expect(await itemRepository.getNextOrderCount()).toBeNull();
    });
    it('return next values', async () => {
      const {
        items: [parentItem1, item1],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 10 }] }] });
      expect(await itemRepository.getNextOrderCount(parentItem1.path, item1.id)).toEqual(30);

      const {
        items: [parentItem2, item2],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 22 }] }] });
      expect(await itemRepository.getNextOrderCount(parentItem2.path, item2.id)).toEqual(42);

      const {
        items: [parentItem3, item3],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 45 }] }] });
      expect(await itemRepository.getNextOrderCount(parentItem3.path, item3.id)).toEqual(65);
    });
    it('return biggest value if no item id', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({
        actor: null,
        items: [{ children: [{ order: 10 }, { order: 20 }, { order: 25 }] }],
      });
      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(45);
    });
    it('get next order for empty path', async () => {
      expect(await itemRepository.getNextOrderCount()).toBeNull();
    });
    it('get next order for one child', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 5 }] }] });

      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(25);
    });
    it('get next order in between two children', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 30 }, { order: 40 }] }] });

      expect(await itemRepository.getNextOrderCount(parentItem.path, item.id)).toEqual(35);
    });
    it('get next order for last child', async () => {
      const {
        items: [parentItem, _item, lastItem],
      } = await seedFromJson({ items: [{ children: [{ order: 30 }, { order: 40 }] }] });
      expect(await itemRepository.getNextOrderCount(parentItem.path, lastItem.id)).toEqual(60);
    });
    it('no previous item id return latest order', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 40 }] }] });
      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(60);
    });
  });
  describe('getFirstOrderValue', () => {
    it('get first order for empty path', async () => {
      expect(await itemRepository.getFirstOrderValue()).toBeNull();
    });
    it('get first order for no child', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{}] });
      expect(await itemRepository.getFirstOrderValue(parentItem.path)).toEqual(DEFAULT_ORDER);
    });
    it('get first order for children', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 40 }, { order: 50 }] }] });
      expect(await itemRepository.getFirstOrderValue(parentItem.path)).toEqual(20);
    });
  });
  describe('reorder', () => {
    it('no previous item reorder at first place', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 10 }] }] });
      await itemRepository.reorder(item, parentItem.path);
      expect(await getOrderForItemId(itemRawRepository, item.id)).toEqual(5);
    });
    it('reorder in one child will return smaller order', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 10 }] }] });
      await itemRepository.reorder(item, parentItem.path);
      expect(await getOrderForItemId(itemRawRepository, item.id)).toBeLessThan(10);
    });
    it('reorder in root returns null', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      await itemRepository.reorder(item, '');
      // cannot use findOne because order is null
      expect(await getOrderForItemId(itemRawRepository, item.id)).toBeNull();
    });
    it('reorder in between children after previous item', async () => {
      const {
        items: [parentItem, item, previousItem],
      } = await seedFromJson({
        items: [{ children: [{ order: 40 }, { order: 50 }, { order: 70 }] }],
      });

      await itemRepository.reorder(item, parentItem.path, previousItem.id);

      expect(await getOrderForItemId(itemRawRepository, item.id)).toEqual(60);
    });
    it('reorder at the end after previous item', async () => {
      const {
        items: [parentItem, item, previousItem],
      } = await seedFromJson({
        items: [{ children: [{ order: 40 }, { order: 50 }] }],
      });

      await itemRepository.reorder(item, parentItem.path, previousItem.id);
      expect(await getOrderForItemId(itemRawRepository, item.id)).toEqual(70);
    });
  });
  describe('rescaleOrder', () => {
    it('rescale no children does no update', async () => {
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({
        items: [{}],
      });
      const updateFn = jest.spyOn(itemRawRepository, 'update');
      await itemRepository.rescaleOrder(actor, parentItem);
      expect(updateFn).not.toHaveBeenCalled();
    });
    it('rescale children', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4],
      } = await seedFromJson({
        items: [
          { children: [{ order: 10.1 }, { order: 10.12 }, { order: 10.14 }, { order: 10.13 }] },
        ],
      });

      await itemRepository.rescaleOrder(actor, parentItem);

      expect(await getOrderForItemId(itemRawRepository, item1.id)).toEqual(20);
      expect(await getOrderForItemId(itemRawRepository, item2.id)).toEqual(40);
      expect(await getOrderForItemId(itemRawRepository, item3.id)).toEqual(80);
      expect(await getOrderForItemId(itemRawRepository, item4.id)).toEqual(60);
    });
    it('rescale children for null values', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4, item5],
      } = await seedFromJson({
        items: [
          {
            children: [
              { order: 10.1 },
              { createdAt: new Date(Date.now() - 1000), order: null },
              { order: 16 },
              { order: 13 },
              { createdAt: new Date(Date.now()), order: null },
            ],
          },
        ],
      });

      await itemRepository.rescaleOrder(actor, parentItem);

      expect(await getOrderForItemId(itemRawRepository, item1.id)).toEqual(20);
      // null value is at the end but before item5 because it is the least recent
      expect(await getOrderForItemId(itemRawRepository, item2.id)).toEqual(80);
      expect(await getOrderForItemId(itemRawRepository, item3.id)).toEqual(60);
      expect(await getOrderForItemId(itemRawRepository, item4.id)).toEqual(40);
      // null value is at the end because it's the most recent
      expect(await getOrderForItemId(itemRawRepository, item5.id)).toEqual(100);
    });
    it('rescale children for identical values', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4, item5],
      } = await seedFromJson({
        items: [
          {
            children: [
              { order: 10.1 },
              { createdAt: new Date(Date.now() - 1000), order: 3 },
              { order: 16 },
              { order: 13 },
              { createdAt: new Date(Date.now()), order: 3 },
            ],
          },
        ],
      });

      await itemRepository.rescaleOrder(actor, parentItem);

      expect(await getOrderForItemId(itemRawRepository, item1.id)).toEqual(60);
      // first among duplicata because is more recent
      expect(await getOrderForItemId(itemRawRepository, item2.id)).toEqual(20);
      expect(await getOrderForItemId(itemRawRepository, item3.id)).toEqual(100);
      expect(await getOrderForItemId(itemRawRepository, item4.id)).toEqual(80);
      // second among duplicata because is less recent
      expect(await getOrderForItemId(itemRawRepository, item5.id)).toEqual(40);
    });
    it('do not rescale if bigger than threshold', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4],
      } = await seedFromJson({
        items: [{ children: [{ order: 11 }, { order: 12 }, { order: 14 }, { order: 13 }] }],
      });

      await itemRepository.rescaleOrder(actor, parentItem);

      expect(await getOrderForItemId(itemRawRepository, item1.id)).toEqual(11);
      expect(await getOrderForItemId(itemRawRepository, item2.id)).toEqual(12);
      expect(await getOrderForItemId(itemRawRepository, item3.id)).toEqual(14);
      expect(await getOrderForItemId(itemRawRepository, item4.id)).toEqual(13);
    });
  });
});
