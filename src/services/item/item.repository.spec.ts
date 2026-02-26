// This import is necessary so we only download needed langage. eslint can't find the import because it's dynamic.
// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker/locale/en';
import { eq, inArray } from 'drizzle-orm/sql';
import { v4 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { MAX_ITEM_NAME_LENGTH, MAX_TREE_LEVELS, buildPathFromIds } from '@graasp/sdk';

import { ItemFactory } from '../../../test/factories/item.factory';
import { buildFile, seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { items, itemsRawTable, publishedItemsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  TooManyDescendants,
} from '../../utils/errors';
import { assertIsMember, assertIsMemberForTest } from '../authentication';
import { expectAccount } from '../member/test/fixtures/members';
import { MemberDTO } from '../member/types';
import { DEFAULT_ORDER } from './constants';
import { type FolderItem, type ItemRaw, resolveItemType } from './item';
import { ItemRepository } from './item.repository';
import { expectItem, expectManyItems } from './test/fixtures/items.vitest';

const alphabeticalOrder = (a: string, b: string) => a.localeCompare(b);

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
        memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
      },
      {
        isPublic: true,
        creator: { name: 'bob' },
        memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
      },
      {
        isPublic: true,
        creator: { name: 'bob' },
        memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
      },
    ],
  });

  for (const item of items) {
    await db.insert(publishedItemsTable).values({ itemPath: item.path, creatorId: member.id });
  }
  return { items, member };
};

const getOrderForItemId = async (itemId: ItemRaw['id']): Promise<number | null> => {
  try {
    const res = await db.select().from(items).where(eq(items.id, itemId));
    return res[0].order;
  } catch (_e) {
    return null;
  }
};

const expectParent = (
  value: { id: string; name: string; path: string },
  reference: { id: string; name: string; path: string },
) => {
  expect(value.id).toEqual(reference.id);
  expect(value.name).toEqual(reference.name);
  expect(value.path).toEqual(reference.path);
};

const itemRepository = new ItemRepository();
const itemRawRepository = {
  findOneBy: async ({ id }: { id: string }) => {
    const res = await db.select().from(items).where(eq(items.id, id));
    return res.at(0);
  },
  countBy: async ({ id }: { id: string }) => await db.$count(items, eq(items.id, id)),
};

describe('Item Repository', () => {
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

      expect(await itemRepository.checkNumberOfDescendants(db, item, 10)).toBeUndefined();
    });
    it('throws because item is too deep', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{ children: [{ children: [{}, {}] }] }] });

      await expect(itemRepository.checkNumberOfDescendants(db, item, 2)).rejects.toBeInstanceOf(
        TooManyDescendants,
      );
    });
    it('throw for deep item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      try {
        await itemRepository.checkNumberOfDescendants(db, item, 0);
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
      const item = itemRepository.createOne({
        name: 'name',
        creator: new MemberDTO(creator).toMinimal(),
      });
      expect(item.path).not.toContain('.');
      expect(item.name).toEqual('name');
      expect(item.lang).toEqual('en');
      expect(item.description).toEqual(null);
      expect(item.type).toEqual('folder');
      expect(item.creatorId).toEqual(creator.id);
      expect(item.extra).toEqual({ folder: {} });
    });
    it('create default document item', async () => {
      const {
        members: [creator],
      } = await seedFromJson({ actor: null, members: [{}] });
      const item = itemRepository.createOne({
        type: 'document',
        name: 'name',
        description: 'description',
        creator: new MemberDTO(creator).toMinimal(),
        extra: { document: { content: '' } },
        lang: 'fr',
      });
      expect(item.path).not.toContain('.');
      expect(item.name).toEqual('name');
      expect(item.description).toEqual('description');
      expect(item.type).toEqual('document');
      expect(item.lang).toEqual('fr');
      expect(item.creatorId).toEqual(creator.id);
      expect(item.extra).toEqual({ document: { content: '' } });
    });
    it('create child item', async () => {
      const {
        items: [parentItem],
        members: [creator],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });
      const name = faker.word.words(3);
      const item = itemRepository.createOne({
        name,
        creator: new MemberDTO(creator).toMinimal(),
        parent: parentItem,
      });
      expect(item.path).toContain(parentItem.path);
      expect(item.name).toEqual(name);
      expect(item.description).toEqual(null);
      expect(item.type).toEqual('folder');
      expect(item.creatorId).toEqual(creator.id);
    });
  });

  describe('deleteMany', () => {
    it('delete successfully', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await itemRepository.delete(db, [item.id]);
      expect(await itemRawRepository.findOneBy({ id: item.id })).toBeUndefined();
    });
    it('delete non existant ids does not throw', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await itemRepository.delete(db, [v4()]);
      expect(await db.$count(items, eq(items.id, item.id))).toEqual(1);
    });
    it('delete many ids', async () => {
      const {
        items: [item1, item2, item3],
      } = await seedFromJson({ actor: null, items: [{}, {}, { name: 'noise' }] });

      await itemRepository.delete(db, [item1.id, item2.id]);
      expect(await itemRawRepository.findOneBy({ id: item1.id })).toBeUndefined();
      expect(await itemRawRepository.findOneBy({ id: item2.id })).toBeUndefined();
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
      const result = await itemRepository.getOne(db, item.id);
      expectItem(result, item);
      // contains creator
      expectAccount(result?.creator, actor);
    });
    it('getOrThrow item successfully', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ creator: 'actor' }] });
      assertIsDefined(actor);
      assertIsMember(actor);
      const result = await itemRepository.getOneOrThrow(db, item.id);
      expectItem(result, item);
    });
    it('getOne returns null for a non-existent id', async () => {
      const id = v4();
      expect(await itemRepository.getOne(db, id)).toBeNull();
    });
    it('getOneOrThrow throws ItemNotFound for a non-existent id', async () => {
      const id = v4();
      await expect(async () => await itemRepository.getOneOrThrow(db, id)).rejects.toThrow(
        new ItemNotFound(id),
      );
    });
    it('getOneWithCreatorOrThrow returns item with creator successfully', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ creator: 'actor' }] });
      assertIsDefined(actor);
      assertIsMember(actor);
      const result = await itemRepository.getOneWithCreatorOrThrow(db, item.id);
      expectItem(result, item);
      // contains creator
      expectAccount(result.creator, actor);
    });
  });

  describe('getAncestors', () => {
    it('Returns successfully in order', async () => {
      const {
        items: [parent, child1, childOfChild],
      } = await seedFromJson({ items: [{ children: [{ children: [{}] }, { name: 'noise' }] }] });

      const parents = [parent, child1];

      // patch item to force reorder
      await itemRepository.updateOne(db, parent.id, { name: 'newname' });
      parent.name = 'newname';

      const data = await itemRepository.getAncestors(db, childOfChild);
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

      const data = await itemRepository.getAncestors(db, parent);

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

      assertIsDefined(actor);

      const data = await itemRepository.getChildren(db, parentItem);
      expect(data).toHaveLength(children.length);
      expectManyItems(data, children);
    });
    it('Returns successfully empty children', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({ items: [{}] });

      assertIsDefined(actor);

      const response = await itemRepository.getChildren(db, parent);

      expect(response).toEqual([]);
    });

    it('Returns ordered children', async () => {
      const {
        actor,
        items: [parent, child1, child2],
      } = await seedFromJson({ items: [{ children: [{ order: 2 }, { order: 1 }] }] });

      const childrenInOrder = [child2, child1];
      const children = [child1, child2];

      assertIsDefined(actor);

      const data = await itemRepository.getChildren(db, parent);
      expect(data).toHaveLength(children.length);
      // verify order and content
      childrenInOrder.forEach((child, idx) => {
        const resultChild = data[idx];
        expectItem(resultChild, child);
      });
    });

    it('returns error without leaking information', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: 'document' }],
      });

      assertIsDefined(actor);

      await expect(itemRepository.getChildren(db, item)).rejects.toMatchObject(
        new ItemNotFolder({ id: item.id }),
      );
    });
  });

  describe('getFilteredChildren', () => {
    it('Returns successfully', async () => {
      const {
        actor,
        items: [parentItem, child1, _childOfChild, child2],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            children: [
              { creator: 'actor', children: [{ creator: 'actor' }] },
              { creator: 'actor' },
            ],
          },
        ],
      });
      const children = [child1, child2];

      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();

      const data = await itemRepository.getFilteredChildren(db, maybeUser, parentItem);
      expect(data).toHaveLength(children.length);
      expectManyItems(data, children, actor);
      data.forEach((d) => expect(d.creator!.name).toEqual(actor.name));
    });
    it('Returns successfully empty children', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({ items: [{}] });

      assertIsDefined(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();

      const response = await itemRepository.getFilteredChildren(db, maybeUser, parent);

      expect(response).toEqual([]);
    });

    it('Returns ordered children', async () => {
      const {
        actor,
        items: [parent, child1, child2],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            children: [
              { creator: 'actor', order: 2 },
              { creator: 'actor', order: 1 },
            ],
          },
        ],
      });

      const childrenInOrder = [child2, child1];
      const children = [child1, child2];

      assertIsDefined(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();

      const data = await itemRepository.getFilteredChildren(db, maybeUser, parent);
      expect(data).toHaveLength(children.length);
      // verify order and content
      childrenInOrder.forEach((child, idx) => {
        const resultChild = data[idx];
        expectItem(resultChild, child);
        expect(resultChild.creator!.name).toEqual(actor.name);
      });
    });

    it('Filter children by Folder', async () => {
      const {
        actor,
        items: [parent, notAFolder, child2],
      } = await seedFromJson({
        items: [{ children: [{ type: 'document' }, { type: 'folder' }] }],
      });

      const children = [child2];
      assertIsDefined(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();
      const data = await itemRepository.getFilteredChildren(db, maybeUser, parent, {
        types: ['folder'],
      });
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

      assertIsDefined(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();

      const data = await itemRepository.getFilteredChildren(db, maybeUser, parent, {
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
        items: [{ type: 'document' }],
      });

      assertIsDefined(actor);
      const maybeUser = new MemberDTO(actor).toMaybeUser();

      await expect(itemRepository.getFilteredChildren(db, maybeUser, item)).rejects.toMatchObject(
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

      const data = await itemRepository.getDescendants(db, parent as FolderItem);
      expect(data).toHaveLength(descendants.length);
      expectManyItems(data, descendants);
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

      const response = await itemRepository.getDescendants(db, parent as FolderItem);

      expect(response).toEqual([]);
    });
  });

  describe('getMany', () => {
    it('return empty for empty ids', async () => {
      const result = await itemRepository.getMany(db, []);
      expect(result).toHaveLength(0);
    });
    it('return result for ids', async () => {
      const {
        items: [item1, item2, item3],
      } = await seedFromJson({ actor: null, items: [{}, {}, {}] });

      const result = await itemRepository.getMany(db, [item2.id, item1.id, item3.id]);
      expect(result).toHaveLength(3);
      expectItem(result[1], item1);
      expectItem(result[0], item2);
      expectItem(result[2], item3);
    });
    it('throw if one item is not found', async () => {
      const {
        items: [item1, item2, item3],
      } = await seedFromJson({ actor: null, items: [{}, {}, {}] });

      const missingId = v4();
      expect(() =>
        itemRepository.getMany(db, [item2.id, item1.id, item3.id, missingId]),
      ).rejects.toMatchObject(ItemNotFound(missingId));
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
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(db, item)).toEqual(2);
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(db, child)).toEqual(0);
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

      expect((await itemRepository.move(db, child)).id).toEqual(child.id);
      const newItem = await itemRawRepository.findOneBy({ id: child.id });
      expect(newItem!.path).toEqual(buildPathFromIds(child.id));
    });
    it('move item into parent', async () => {
      const {
        items: [item1, item2],
      } = await seedFromJson({ actor: null, items: [{}, {}] });
      const movedItem = await itemRepository.move(db, item1, item2 as FolderItem);
      expect(movedItem.id).toEqual(item1.id);
      const newItem = await itemRawRepository.findOneBy({ id: item1.id });
      expect(newItem).toBeDefined();
      expect(newItem?.path).toEqual(buildPathFromIds(item2.id, item1.id));
    });
    it('Fail to move items in non-folder parent', async () => {
      const {
        items: [item1, item2],
      } = await seedFromJson({ actor: null, items: [{}, { type: 'document' }] });

      await expect(itemRepository.move(db, item1, item2 as FolderItem)).rejects.toBeInstanceOf(
        ItemNotFolder,
      );
    });
    it('Fail to move into self', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      await expect(itemRepository.move(db, item, item as FolderItem)).rejects.toBeInstanceOf(
        InvalidMoveTarget,
      );
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
      await expect(itemRepository.move(db, parent)).rejects.toBeInstanceOf(InvalidMoveTarget);

      await expect(itemRepository.move(db, child, parent as FolderItem)).rejects.toBeInstanceOf(
        InvalidMoveTarget,
      );
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
      const newItem = await itemRepository.updateOne(db, item.id, newData);
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
            type: 'file',
            extra: {
              ['file']: {
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
        ['file']: {
          content: 'hello',
        },
        // incorrect data
        document: { content: 'some content' },
      };
      const newItem = await itemRepository.updateOne(db, item.id, { extra: newData });
      expectItem(newItem, {
        ...item,
        extra: {
          ['file']: {
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
          ['file']: {
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
      const newItem = await itemRepository.updateOne(db, item.id, newData);
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
      const data = { name: 'name', type: 'folder' as const };

      const newItem = await itemRepository.addOne(db, {
        item: data,
        creator: new MemberDTO(member).toMinimal(),
      });
      const newItemInDb = await db.query.itemsRawTable.findFirst({
        where: eq(items.id, newItem.id),
      });
      expect(newItemInDb!.name).toEqual(data.name);
      expect(newItemInDb!.type).toEqual(data.type);
      expect(newItemInDb!.creatorId).toEqual(member.id);
    });
    it('post successfully with parent item', async () => {
      const {
        members: [member],
        items: [parentItem],
      } = await seedFromJson({ members: [{}], items: [{}] });
      const data = { name: 'name-1', type: 'file' as const };

      const newItem = await itemRepository.addOne(db, {
        item: data,
        creator: new MemberDTO(member).toMinimal(),
        parentItem: parentItem as FolderItem,
      });
      const newItemInDb = await db.query.itemsRawTable.findFirst({
        where: eq(items.id, newItem.id),
      });

      expect(newItemInDb!.name).toEqual(data.name);
      expect(newItemInDb!.type).toEqual(data.type);
      expect(newItemInDb!.path).toContain(parentItem.path);
      expect(newItemInDb!.creatorId).toEqual(member.id);
    });
  });

  describe('postMany', () => {
    it('post many', async () => {
      const {
        members: [member],
      } = await seedFromJson({ actor: null, members: [{}] });
      const localItems = Array.from({ length: 15 }, () =>
        ItemFactory({ type: 'folder', creator: member }),
      );

      const insertedItems = await itemRepository.addMany(
        db,
        localItems,
        new MemberDTO(member).toMinimal(),
      );
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creatorId);

      const itemsInDB = await db.select().from(items).where(inArray(items.name, insertedItemNames));

      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creatorId);
      const itemPathsInDb = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemNames.toSorted(alphabeticalOrder),
      );
      expect(itemTypesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemTypes.toSorted(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB).toEqual(insertedItemCreatorIds);
      expect(itemPathsInDb.every((path) => !path.includes('.'))).toBeTruthy();
    });
    it('post many with parent item', async () => {
      const {
        members: [member],
        items: [parentItem],
      } = await seedFromJson({ actor: null, members: [{}], items: [{}] });

      const localItems = Array.from({ length: 15 }, (_v) =>
        ItemFactory({ type: 'folder', creator: member }),
      );

      const insertedItems = await itemRepository.addMany(
        db,
        localItems,
        new MemberDTO(member).toMinimal(),
        parentItem as FolderItem,
      );
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creatorId);
      const insertedItemPaths = insertedItems.map((i) => i.path);

      const itemsInDB = await db.select().from(items).where(inArray(items.name, insertedItemNames));
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creatorId);
      const itemPathsInDB = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemNames.toSorted(alphabeticalOrder),
      );
      expect(itemTypesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemTypes.toSorted(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB).toEqual(insertedItemCreatorIds);
      expect(itemPathsInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemPaths.toSorted(alphabeticalOrder),
      );
      expect(itemPathsInDB.every((path) => path.includes(`${parentItem.path}.`))).toBeTruthy();
    });
  });

  describe('postMany', () => {
    it('post many', async () => {
      const { actor } = await seedFromJson({});
      assertIsDefined(actor);
      const localItems = Array.from({ length: 15 }, () =>
        ItemFactory({
          type: 'folder',
          creator: new MemberDTO(actor).toCurrent(),
        }),
      );

      assertIsDefined(actor);
      const insertedItems = await itemRepository.addMany(
        db,
        localItems,
        new MemberDTO(actor).toMinimal(),
      );
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creatorId);

      const itemsInDB = await db.select().from(items).where(inArray(items.name, insertedItemNames));
      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creatorId);
      const itemPathsInDb = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemNames.toSorted(alphabeticalOrder),
      );
      expect(itemTypesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemTypes.toSorted(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB).toEqual(insertedItemCreatorIds);
      expect(itemPathsInDb.every((path) => !path.includes('.'))).toBeTruthy();
    });
    it('post many with parent item', async () => {
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({ items: [{ creator: 'actor' }] });
      assertIsDefined(actor);
      const localItems = Array.from({ length: 15 }, (_v) =>
        ItemFactory({
          type: 'folder',
          creator: new MemberDTO(actor).toCurrent(),
        }),
      );

      const insertedItems = await itemRepository.addMany(
        db,
        localItems,
        new MemberDTO(actor).toMinimal(),
        parentItem as FolderItem,
      );
      const insertedItemNames = insertedItems.map((i) => i.name);
      const insertedItemTypes = insertedItems.map((i) => i.type);
      const insertedItemCreatorIds = insertedItems.map((i) => i.creatorId);
      const insertedItemPaths = insertedItems.map((i) => i.path);

      const itemsInDB = await db.select().from(items).where(inArray(items.name, insertedItemNames));

      const itemNamesInDB = itemsInDB.map((i) => i.name);
      const itemTypesInDB = insertedItems.map((i) => i.type);
      const itemCreatorIdsInDB = insertedItems.map((i) => i.creatorId);
      const itemPathsInDB = insertedItems.map((i) => i.path);

      expect(itemNamesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemNames.toSorted(alphabeticalOrder),
      );
      expect(itemTypesInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemTypes.toSorted(alphabeticalOrder),
      );
      expect(itemCreatorIdsInDB).toEqual(insertedItemCreatorIds);
      expect(itemPathsInDB.toSorted(alphabeticalOrder)).toEqual(
        insertedItemPaths.toSorted(alphabeticalOrder),
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
      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
      );
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

      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
        parentItem as FolderItem,
      );
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

      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
      );
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
      const secondResult = await itemRepository.copy(db, copy, new MemberDTO(member).toMinimal(), [
        item.name,
        copy.name,
      ]);
      const secondCopy = secondResult.copyRoot;
      expect(secondCopy.name).toEqual(`${item.name} (3)`);
      const thirdResult = await itemRepository.copy(
        db,
        secondCopy,
        new MemberDTO(member).toMinimal(),
        [item.name, copy.name, secondCopy.name],
      );
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
        items: [{}, { type: 'document' }],
      });
      await expect(
        itemRepository.copy(
          db,
          resolveItemType(item),
          new MemberDTO(member).toMinimal(),
          [],
          parentItem as FolderItem,
        ),
      ).rejects.toBeInstanceOf(ItemNotFolder);
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

      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
      );
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(db, copy, new MemberDTO(member).toMinimal(), [
        item.name,
        copy.name,
      ]);
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
      await itemRepository.updateOne(db, item.id, item);
      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
      );
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(db, copy, new MemberDTO(member).toMinimal(), [
        item.name,
        copy.name,
      ]);
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
      await itemRepository.updateOne(db, item.id, item);
      const result = await itemRepository.copy(
        db,
        resolveItemType(item),
        new MemberDTO(member).toMinimal(),
        [item.name],
      );
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (2)`);

      copy.name = `${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (9)`;
      await itemRepository.updateOne(db, copy.id, copy);
      const result2 = await itemRepository.copy(db, copy, new MemberDTO(member).toMinimal(), [
        item.name,
        copy.name,
      ]);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 5)} (10)`);
    });
  });

  describe('getItemSumSize', () => {
    const itemType = 'file';
    it('get sum for no item', async () => {
      const {
        members: [member],
      } = await seedFromJson({
        actor: null,
        members: [{}],
      });
      const result = await itemRepository.getItemSumSize(db, member.id);
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

      const result = await itemRepository.getItemSumSize(db, actor.id);
      expect(result).toEqual(
        item1.extra[itemType].size + item2.extra[itemType].size + item3.extra[itemType].size,
      );
    });
  });
  describe('getPublishedItemsForMember', () => {
    it('get published items for member', async () => {
      const { items, member } = await saveCollections();
      // noise
      await saveCollections();

      const result = await itemRepository.getPublishedItemsForMember(db, member.id);
      expectManyItems(result, items);
    });
  });
  describe('getNextOrderCount', () => {
    it('return default value for no children', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ members: [{}], items: [{}] });
      expect(await itemRepository.getNextOrderCount(db, parentItem.path)).toEqual(DEFAULT_ORDER);
    });
    it('no parent returns null', async () => {
      expect(await itemRepository.getNextOrderCount(db)).toBeNull();
    });
    it('return next values', async () => {
      const {
        items: [parentItem1, item1],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 10 }] }] });
      expect(await itemRepository.getNextOrderCount(db, parentItem1.path, item1.id)).toEqual(30);

      const {
        items: [parentItem2, item2],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 22 }] }] });
      expect(await itemRepository.getNextOrderCount(db, parentItem2.path, item2.id)).toEqual(42);

      const {
        items: [parentItem3, item3],
      } = await seedFromJson({ actor: null, items: [{ children: [{ order: 45 }] }] });
      expect(await itemRepository.getNextOrderCount(db, parentItem3.path, item3.id)).toEqual(65);
    });
    it('return biggest value if no item id', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({
        actor: null,
        items: [{ children: [{ order: 10 }, { order: 20 }, { order: 25 }] }],
      });
      expect(await itemRepository.getNextOrderCount(db, parentItem.path)).toEqual(45);
    });
    it('get next order for empty path', async () => {
      expect(await itemRepository.getNextOrderCount(db)).toBeNull();
    });
    it('get next order for one child', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 5 }] }] });

      expect(await itemRepository.getNextOrderCount(db, parentItem.path)).toEqual(25);
    });
    it('get next order in between two children', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 30 }, { order: 40 }] }] });

      expect(await itemRepository.getNextOrderCount(db, parentItem.path, item.id)).toEqual(35);
    });
    it('get next order for last child', async () => {
      const {
        items: [parentItem, _item, lastItem],
      } = await seedFromJson({ items: [{ children: [{ order: 30 }, { order: 40 }] }] });
      expect(await itemRepository.getNextOrderCount(db, parentItem.path, lastItem.id)).toEqual(60);
    });
    it('no previous item id return latest order', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 40 }] }] });
      expect(await itemRepository.getNextOrderCount(db, parentItem.path)).toEqual(60);
    });
  });
  describe('getFirstOrderValue', () => {
    it('get first order for empty path', async () => {
      expect(await itemRepository.getFirstOrderValue(db)).toBeNull();
    });
    it('get first order for no child', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{}] });
      expect(await itemRepository.getFirstOrderValue(db, parentItem.path)).toEqual(DEFAULT_ORDER);
    });
    it('get first order for children', async () => {
      const {
        items: [parentItem],
      } = await seedFromJson({ items: [{ children: [{ order: 40 }, { order: 50 }] }] });
      expect(await itemRepository.getFirstOrderValue(db, parentItem.path)).toEqual(20);
    });
  });
  describe('reorder', () => {
    it('no previous item reorder at first place', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 10 }] }] });
      const reOrderedItem = await itemRepository.reorder(db, item, parentItem.path);
      expect(reOrderedItem.order).toEqual(5);
    });
    it('reorder in one child will return smaller order', async () => {
      const {
        items: [parentItem, item],
      } = await seedFromJson({ items: [{ children: [{ order: 10 }] }] });
      const reOrderedItem = await itemRepository.reorder(db, item, parentItem.path);
      expect(reOrderedItem.order).toBeLessThan(10);
    });
    it('reorder in root returns null', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const reOrderedItem = await itemRepository.reorder(db, item, '');
      // cannot use findOne because order is null
      expect(reOrderedItem.order).toBeNull();
    });
    it('reorder in between children after previous item', async () => {
      const {
        items: [parentItem, item, previousItem],
      } = await seedFromJson({
        items: [{ children: [{ order: 40 }, { order: 50 }, { order: 70 }] }],
      });

      const reOrderedItem = await itemRepository.reorder(
        db,
        item,
        parentItem.path,
        previousItem.id,
      );

      expect(reOrderedItem.order).toEqual(60);
    });
    it('reorder at the end after previous item', async () => {
      const {
        items: [parentItem, item, previousItem],
      } = await seedFromJson({
        items: [{ children: [{ order: 40 }, { order: 50 }] }],
      });

      const reOrderedItem = await itemRepository.reorder(
        db,
        item,
        parentItem.path,
        previousItem.id,
      );
      expect(reOrderedItem.order).toEqual(70);
    });
  });
  describe('rescaleOrder', () => {
    // HOW to check if there was an update ? we can not spy on the repo since we do the update directly.
    // it.skip('rescale no children does no update', async () => {
    //   const {
    //     actor,
    //     items: [parentItem],
    //   } = await seedFromJson({
    //     items: [{}],
    //   });
    //   // const updateFn = vi.spyOn(itemRawRepository, 'update');
    //   await itemRepository.rescaleOrder(db, actor, parentItem);
    //   // expect(updateFn).not.toHaveBeenCalled();
    // });
    it('rescale children', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4],
      } = await seedFromJson({
        items: [
          { children: [{ order: 10.1 }, { order: 10.12 }, { order: 10.14 }, { order: 10.13 }] },
        ],
      });

      assertIsDefined(actor);
      await itemRepository.rescaleOrder(db, parentItem as FolderItem);

      expect(await getOrderForItemId(item1.id)).toEqual(20);
      expect(await getOrderForItemId(item2.id)).toEqual(40);
      expect(await getOrderForItemId(item3.id)).toEqual(80);
      expect(await getOrderForItemId(item4.id)).toEqual(60);
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
              { createdAt: new Date(Date.now() - 1000).toISOString(), order: null },
              { order: 16 },
              { order: 13 },
              { createdAt: new Date(Date.now()).toISOString(), order: null },
            ],
          },
        ],
      });

      assertIsDefined(actor);
      await itemRepository.rescaleOrder(db, parentItem as FolderItem);

      expect(await getOrderForItemId(item1.id)).toEqual(20);
      // null value is at the end but before item5 because it is the least recent
      expect(await getOrderForItemId(item2.id)).toEqual(80);
      expect(await getOrderForItemId(item3.id)).toEqual(60);
      expect(await getOrderForItemId(item4.id)).toEqual(40);
      // null value is at the end because it's the most recent
      expect(await getOrderForItemId(item5.id)).toEqual(100);
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
              { createdAt: new Date(Date.now() - 1000).toISOString(), order: 3 },
              { order: 16 },
              { order: 13 },
              { createdAt: new Date(Date.now()).toISOString(), order: 3 },
            ],
          },
        ],
      });

      assertIsDefined(actor);
      await itemRepository.rescaleOrder(db, parentItem as FolderItem);

      expect(await getOrderForItemId(item1.id)).toEqual(60);
      // first among duplicata because is more recent
      expect(await getOrderForItemId(item2.id)).toEqual(20);
      expect(await getOrderForItemId(item3.id)).toEqual(100);
      expect(await getOrderForItemId(item4.id)).toEqual(80);
      // second among duplicata because is less recent
      expect(await getOrderForItemId(item5.id)).toEqual(40);
    });
    it('throw if one update throws and rollback in transaction', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4],
      } = await seedFromJson({
        items: [
          { children: [{ order: 10.1 }, { order: 10.12 }, { order: 10.14 }, { order: 10.13 }] },
        ],
      });

      assertIsDefined(actor);

      let updateMock;
      try {
        await db.transaction(async (tx) => {
          updateMock = vi.spyOn(tx, 'update').mockImplementationOnce(() => {
            throw new Error('mock update error');
          });

          await itemRepository.rescaleOrder(tx, parentItem as FolderItem);
        });
        // function should have rejected
        expect(false).toBeTruthy();
      } catch (_e) {
        // function rejected as expected
        expect(updateMock).toHaveBeenCalledTimes(4);
      }

      expect(await getOrderForItemId(item1.id)).toEqual(10.1);
      expect(await getOrderForItemId(item2.id)).toEqual(10.12);
      expect(await getOrderForItemId(item3.id)).toEqual(10.14);
      expect(await getOrderForItemId(item4.id)).toEqual(10.13);
    });
    it('do not rescale if bigger than threshold', async () => {
      const {
        actor,
        items: [parentItem, item1, item2, item3, item4],
      } = await seedFromJson({
        items: [{ children: [{ order: 11 }, { order: 12 }, { order: 14 }, { order: 13 }] }],
      });

      assertIsDefined(actor);
      await itemRepository.rescaleOrder(db, parentItem as FolderItem);

      expect(await getOrderForItemId(item1.id)).toEqual(11);
      expect(await getOrderForItemId(item2.id)).toEqual(12);
      expect(await getOrderForItemId(item3.id)).toEqual(14);
      expect(await getOrderForItemId(item4.id)).toEqual(13);
    });
  });

  describe('fixOrderForTree', () => {
    it('fix order of tree', async () => {
      const {
        items: [
          corruptedParent,
          corr1,
          corr2,
          corr3,
          sc1,
          sc2,
          sc3,
          unt1,
          unt2,
          unt3,
          _untouchedParent,
          unt4,
          unt5,
          unt6,
        ],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            children: [
              { order: 1, createdAt: '2012-10-05T14:48:00.000Z' },
              { order: 20, createdAt: '2013-10-05T14:48:00.000Z' },
              {
                order: 20,
                createdAt: '2010-10-05T14:48:00.000Z',
                children: [
                  { order: 20, createdAt: '2013-10-05T14:48:00.000Z' },
                  { order: 20, createdAt: '2010-10-05T14:48:00.000Z' },
                  {
                    order: 20,
                    createdAt: '2012-10-05T14:48:00.000Z',
                    // should not change
                    children: [{ order: 1 }, { order: 2 }, { order: 3 }],
                  },
                ],
              },
            ],
          },
          // should not change
          { children: [{ order: 1 }, { order: 2 }, { order: 3 }] },
        ],
      });

      await itemRepository.fixOrderForTree(db, corruptedParent.path);

      // order are repaired
      const item = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, corr1.id),
      });
      expect(item!.order).toEqual(20);
      const item1 = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, corr2.id),
      });
      expect(item1!.order).toEqual(60);
      const item2 = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, corr3.id),
      });
      expect(item2!.order).toEqual(40);

      // sub children's order are repaired
      const subitem = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, sc1.id),
      });
      expect(subitem!.order).toEqual(60);
      const subitem1 = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, sc2.id),
      });
      expect(subitem1!.order).toEqual(20);
      const subitem2 = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, sc3.id),
      });
      expect(subitem2!.order).toEqual(40);

      // non corrupted children are untouched
      const u1 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt1.id) });
      expect(u1!.order).toEqual(1);
      const u2 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt2.id) });
      expect(u2!.order).toEqual(2);
      const u3 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt3.id) });
      expect(u3!.order).toEqual(3);
      const u4 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt4.id) });
      expect(u4!.order).toEqual(1);
      const u5 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt5.id) });
      expect(u5!.order).toEqual(2);
      const u6 = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, unt6.id) });
      expect(u6!.order).toEqual(3);
    });

    it('do not throw for non-folder item', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            type: 'document',
            order: 12,
          },
        ],
      });

      await itemRepository.fixOrderForTree(db, item.path);

      // order are repaired
      const i = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, item.id),
      });
      expect(i!.order).toEqual(12);
    });
  });

  describe('getParentsForPublic', () => {
    it('return parents up to public root', async () => {
      const {
        items: [_private, publicParent, child],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            children: [{ isPublic: true, children: [{}] }],
          },
        ],
      });

      const parents = await itemRepository.getParentsForPublic(db, child);
      expect(parents.length).toEqual(1);
      expectParent(parents[0], publicParent);
    });

    it('return distinct parents', async () => {
      const {
        items: [publicParent, subParent, child],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            isPublic: true,
            children: [
              {
                isPublic: true,
                children: [{}],
              },
            ],
          },
        ],
      });

      const parents = await itemRepository.getParentsForPublic(db, child);
      expect(parents.length).toEqual(2);
      expectParent(parents[0], publicParent);
      expectParent(parents[1], subParent);
    });
  });

  describe('getParentsForAccount', () => {
    it('return parents up to public root', async () => {
      const {
        actor,
        items: [_private, publicParent, child],
      } = await seedFromJson({
        items: [
          {
            children: [{ isPublic: true, children: [{}] }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);

      const parents = await itemRepository.getParentsForAccount(db, child, actor);
      expect(parents.length).toEqual(1);
      expectParent(parents[0], publicParent);
    });

    it('return parents up to membership root', async () => {
      const {
        actor,
        items: [_private, parent, child],
      } = await seedFromJson({
        items: [
          {
            children: [
              {
                memberships: [{ permission: 'admin', account: 'actor' }],
                children: [{}],
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);

      const parents = await itemRepository.getParentsForAccount(db, child, actor);
      expect(parents.length).toEqual(1);
      expectParent(parents[0], parent);
    });

    it('return parents for read permission', async () => {
      const {
        actor,
        items: [parent, subparent, child],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: 'read', account: 'actor' }],
            children: [{ children: [{}] }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);

      const parents = await itemRepository.getParentsForAccount(db, child, actor);
      expect(parents.length).toEqual(2);
      expectParent(parents[0], parent);
      expectParent(parents[1], subparent);
    });

    it('return parents for many memberships', async () => {
      const {
        actor,
        items: [parent, subparent, child],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: 'read', account: 'actor' }],
            children: [
              {
                memberships: [{ permission: 'admin', account: 'actor' }],
                children: [{}],
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);

      const parents = await itemRepository.getParentsForAccount(db, child, actor);

      expect(parents.length).toEqual(2);
      expectParent(parents[0], parent);
      expectParent(parents[1], subparent);
    });
  });

  it('return distinct parents', async () => {
    const {
      actor,
      items: [publicParent, subParent, child],
    } = await seedFromJson({
      items: [
        {
          isPublic: true,
          children: [
            {
              isPublic: true,
              children: [{}],
            },
          ],
        },
      ],
    });
    assertIsDefined(actor);
    assertIsMember(actor);

    const parents = await itemRepository.getParentsForAccount(db, child, actor);
    expect(parents.length).toEqual(2);
    expectParent(parents[0], publicParent);
    expectParent(parents[1], subParent);
  });
});
