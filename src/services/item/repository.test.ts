// This import is necessary so we only download needed langage. eslint can't find the import because it's dynamic.
// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker/locale/en';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  ItemType,
  LocalFileItemFactory,
  MAX_ITEM_NAME_LENGTH,
  MAX_TREE_LEVELS,
  MemberFactory,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  ItemNotFolder,
  ItemNotFound,
  TooManyDescendants,
} from '../../utils/errors';
import { expectMember, saveMember } from '../member/test/fixtures/members';
import { DEFAULT_ORDER, FolderItem, Item } from './entities/Item';
import { ItemRepository } from './repository';
import { ItemTestUtils, expectItem, expectManyItems } from './test/fixtures/items';

// mock datasource
jest.mock('../../plugins/datasource');
const itemRepository = new ItemRepository();
const testUtils = new ItemTestUtils();

describe('ItemRepository', () => {
  let app: FastifyInstance;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });
  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('checkHierarchyDepth', () => {
    it('depth is acceptable', async () => {
      const item = await testUtils.saveItem({ actor });

      expect(itemRepository.checkHierarchyDepth(item)).toBeUndefined();
    });
    it('depth is acceptable with additional levels', async () => {
      const item = await testUtils.saveItem({ actor });

      expect(itemRepository.checkHierarchyDepth(item, 4)).toBeUndefined();
    });
    it('throw for deep item', async () => {
      const item = await testUtils.saveItem({ actor });
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
      const item = await testUtils.saveItem({ actor });

      expect(await itemRepository.checkNumberOfDescendants(item, 10)).toBeUndefined();
    });
    it('throws because item is too deep', async () => {
      const parent1 = await testUtils.saveItem({ actor });
      const child1 = await testUtils.saveItem({ parentItem: parent1 });
      await testUtils.saveItem({ parentItem: child1 });
      await testUtils.saveItem({ parentItem: child1 });

      await expect(itemRepository.checkNumberOfDescendants(parent1, 2)).rejects.toBeInstanceOf(
        TooManyDescendants,
      );
    });
    it('throw for deep item', async () => {
      const item = await testUtils.saveItem({ actor });
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
      const creator = await saveMember();
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
      const creator = await saveMember();
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
      const creator = await saveMember(MemberFactory({ extra: { lang: 'es' } }));
      const parentItem = await testUtils.createItem();
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
      const item = await testUtils.saveItem({ actor });
      expect(await testUtils.rawItemRepository.count()).toEqual(1);

      await itemRepository.deleteMany([item.id]);
      expect(await testUtils.rawItemRepository.count()).toEqual(0);
    });
    it('delete non existant ids does not throw', async () => {
      await testUtils.saveItem({ actor });
      expect(await testUtils.rawItemRepository.count()).toEqual(1);

      await itemRepository.deleteMany([v4()]);
      expect(await testUtils.rawItemRepository.count()).toEqual(1);
    });
    it('delete many ids', async () => {
      const item1 = await testUtils.saveItem({ actor });
      const item2 = await testUtils.saveItem({ actor });

      // noise
      await testUtils.saveItem({ actor });

      expect(await testUtils.rawItemRepository.count()).toEqual(3);

      await itemRepository.deleteMany([item1.id, item2.id]);
      expect(await testUtils.rawItemRepository.count()).toEqual(1);
    });
  });
  describe('get', () => {
    it('get item successfully', async () => {
      const item = await testUtils.saveItem({ actor });
      const result = await itemRepository.get(item.id);
      expectItem(result, item);
      // contains creator
      expectMember(result.creator, actor);
    });
    it('Not found for missing item given id', async () => {
      const id = v4();
      await expect(itemRepository.get(id)).rejects.toMatchObject(new ItemNotFound(id));
    });
  });
  describe('getAncestors', () => {
    it('Returns successfully in order', async () => {
      const { packedItem: parent, item: parentItem } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        item: { name: 'child1' },
        member: actor,
        parentItem,
      });
      // noise
      await testUtils.saveItemAndMembership({
        item: { name: 'child2' },
        member: actor,
        parentItem,
      });

      const { item: childOfChild } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: parentItem1,
      });
      const parents = [parent, child1];

      // patch item to force reorder
      await itemRepository.patch(parent.id, { name: 'newname' });
      parent.name = 'newname';

      const data = await itemRepository.getAncestors(childOfChild);
      expect(data).toHaveLength(parents.length);
      data.forEach((p, idx) => {
        expectItem(p, parents[idx]);
      });
    });
    it('Returns successfully empty parents', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });

      // another item with child
      const { item: parent1 } = await testUtils.saveItemAndMembership({ member: actor });
      await testUtils.saveItemAndMembership({
        item: { name: 'child1' },
        member: actor,
        parentItem: parent1,
      });
      const data = await itemRepository.getAncestors(parent);

      expect(data).toEqual([]);
    });
  });
  describe('getChildren', () => {
    it('Returns successfully', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });
      const { packedItem: child2 } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });

      const children = [child1, child2];
      // create child of child
      await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });

      const data = await itemRepository.getChildren(parentItem);
      expect(data).toHaveLength(children.length);
      expectManyItems(data, children);
    });
    it('Returns successfully empty children', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });

      const response = await itemRepository.getChildren(parent);

      expect(response).toEqual([]);
    });

    it('Returns ordered children', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
      const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        item: { name: 'child1', order: 2 },
        member: actor,
        parentItem: parent,
      });
      const { packedItem: child2 } = await testUtils.saveItemAndMembership({
        item: { name: 'child2', order: 1 },
        member: actor,
        parentItem: parent,
      });

      const childrenInOrder = [child2, child1];
      const children = [child1, child2];

      // create child of child
      await testUtils.saveItemAndMembership({ member: actor, parentItem: parentItem1 });
      const data = await itemRepository.getChildren(parent, { ordered: true });
      expect(data).toHaveLength(children.length);
      // verify order and content
      childrenInOrder.forEach((child, idx) => {
        const resultChild = data[idx];
        expectItem(resultChild, child);
      });
    });

    it('Filter children by Folder', async () => {
      const member = await saveMember();
      const { item: parent } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const { packedItem: notAFolder } = await testUtils.saveItemAndMembership({
        item: { name: 'child1', type: ItemType.DOCUMENT },
        member,
        parentItem: parent,
      });
      const { item: child2 } = await testUtils.saveItemAndMembership({
        item: { name: 'child2', type: ItemType.FOLDER },
        member,
        parentItem: parent,
      });
      const children = [child2];

      const data = await itemRepository.getChildren(parent, { types: [ItemType.FOLDER] });
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
  });
  describe('getDescendants', () => {
    it('Returns successfully', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
      const { packedItem: child1, item: parentItem1 } = await testUtils.saveItemAndMembership({
        item: { name: 'child1' },
        member: actor,
        parentItem: parent,
      });
      const { packedItem: child2 } = await testUtils.saveItemAndMembership({
        item: { name: 'child2' },
        member: actor,
        parentItem: parent,
      });

      const { packedItem: childOfChild } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: parentItem1,
      });
      const descendants = [child1, child2, childOfChild];

      const data = await itemRepository.getDescendants(parent as FolderItem);
      expect(data).toHaveLength(descendants.length);
      expectManyItems(data, descendants);
    });

    it('Returns successfully ordered', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: parentItem1 } = await testUtils.saveItemAndMembership({
        item: { name: 'child1', order: 3 },
        member: actor,
        parentItem: parent,
      });
      const { item: child2 } = await testUtils.saveItemAndMembership({
        item: { name: 'child2', order: 2 },
        member: actor,
        parentItem: parent,
      });
      const { item: childOfChild } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: parentItem1,
      });
      const { item: childOfChild1 } = await testUtils.saveItemAndMembership({
        item: { name: 'childOfChild1', order: 2 },
        member: actor,
        parentItem: childOfChild,
      });
      const { item: childOfChild2 } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { name: 'childOfChild2', order: 1 },
        parentItem: childOfChild,
      });
      const descendants = [child2, parentItem1, childOfChild, childOfChild2, childOfChild1];
      const data = await itemRepository.getDescendants(parent as FolderItem, { ordered: true });
      expectManyItems(data, descendants);
      descendants.forEach((v, idx) => {
        expectItem(data[idx], v);
      });
    });

    it('Returns successfully empty descendants', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });

      // another item with child
      const { item: parent1 } = await testUtils.saveItemAndMembership({ member: actor });
      await testUtils.saveItemAndMembership({
        item: { name: 'child1' },
        member: actor,
        parentItem: parent1,
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
      const member = await saveMember();
      const parent1 = await testUtils.saveItem({ actor: member });
      const parent2 = await testUtils.saveItem({ actor: member });
      const child1 = await testUtils.saveItem({ parentItem: parent1 });
      const child11 = await testUtils.saveItem({ parentItem: child1 });
      const child2 = await testUtils.saveItem({ parentItem: parent2 });
      const deleted = await testUtils.saveItem({ parentItem: child1 });
      await testUtils.saveRecycledItem(member, deleted);

      const result = await itemRepository.getManyDescendants([parent1, parent2]);

      expectManyItems(result, [child1, child2, child11]);
      expect(result).not.toContain(deleted);
    });
    it('return descendants with deleted', async () => {
      const parent1 = await testUtils.saveItem({ actor });
      const parent2 = await testUtils.saveItem({ actor });
      const child1 = await testUtils.saveItem({ parentItem: parent1 });
      const child11 = await testUtils.saveItem({ parentItem: child1 });
      const child2 = await testUtils.saveItem({ parentItem: parent2 });
      const deleted = await testUtils.saveItem({ parentItem: child1 });
      await testUtils.saveRecycledItem(actor, deleted);

      const result = await itemRepository.getManyDescendants([parent1, parent2], {
        withDeleted: true,
      });

      expectManyItems(result, [child1, child2, child11, deleted]);
    });
  });
  describe('getMany', () => {
    it('return empty for empty ids', async () => {
      const result = await itemRepository.getMany([]);
      expect(Object.keys(result.data)).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
    it('return result for ids with errors', async () => {
      const item1 = await testUtils.saveItem({ actor });
      const item2 = await testUtils.saveItem({ actor });
      const item3 = await testUtils.saveItem({ actor });

      const result = await itemRepository.getMany([item1.id, item2.id, item3.id, v4()]);
      expectItem(result.data[item1.id], item1);
      expectItem(result.data[item2.id], item2);
      expectItem(result.data[item3.id], item3);
      expect(result.errors).toHaveLength(1);
    });
    it('return result for ids with deleted', async () => {
      const item1 = await testUtils.saveItem({ actor });
      const item2 = await testUtils.saveItem({ actor });
      const item3 = await testUtils.saveItem({ actor });
      await testUtils.saveRecycledItem(actor, item3);

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
      const item = await testUtils.saveItem({ actor });
      const child1 = await testUtils.saveItem({ actor, parentItem: item });
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(item)).toEqual(2);
      expect(await itemRepository.getNumberOfLevelsToFarthestChild(child1)).toEqual(0);
    });
  });
  describe('getOwn', () => {
    it('return own items', async () => {
      const { item: item1 } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: item2 } = await testUtils.saveItemAndMembership({ member: actor });
      // noise - child of own
      await testUtils.saveItemAndMembership({ member: actor, parentItem: item2 });
      // noise - no membership
      await testUtils.saveItem({ actor });
      // noise - not creator
      const member = await saveMember();
      await testUtils.saveItemAndMembership({ member: actor, creator: member });
      expectManyItems(await itemRepository.getOwn(actor.id), [item1, item2]);
    });
  });
  describe('move', () => {
    it('move item to root', async () => {
      const parent = await testUtils.saveItem({ actor });
      const item1 = await testUtils.saveItem({ parentItem: parent, actor });

      expect((await itemRepository.move(item1)).id).toEqual(item1.id);
      const newItem = await testUtils.rawItemRepository.findOneBy({ id: item1.id });
      expect(newItem!.path).toEqual(buildPathFromIds(item1.id));
    });
    it('move item into parent', async () => {
      const item1 = await testUtils.saveItem({ actor });
      const item2 = await testUtils.saveItem({ actor });

      expect((await itemRepository.move(item1, item2)).id).toEqual(item1.id);
      const newItem = await testUtils.rawItemRepository.findOneBy({ id: item1.id });
      expect(newItem!.path).toEqual(buildPathFromIds(item2.id, item1.id));
    });
    it('Fail to move items in non-folder parent', async () => {
      const parentItem = await testUtils.saveItem({
        item: { type: ItemType.DOCUMENT },
        actor,
      });
      const item = await testUtils.saveItem({ actor });

      await expect(itemRepository.move(item, parentItem)).rejects.toBeInstanceOf(ItemNotFolder);
    });
    it('Fail to move into self', async () => {
      const item = await testUtils.saveItem({ actor });

      await expect(itemRepository.move(item, item)).rejects.toBeInstanceOf(InvalidMoveTarget);
    });
    it('Fail to move in same parent', async () => {
      // root
      const item = await testUtils.saveItem({ actor });
      await expect(itemRepository.move(item)).rejects.toBeInstanceOf(InvalidMoveTarget);

      const parentItem = await testUtils.saveItem({ actor });
      const item1 = await testUtils.saveItem({ actor, parentItem });
      await expect(itemRepository.move(item1, parentItem)).rejects.toBeInstanceOf(
        InvalidMoveTarget,
      );
    });
  });

  describe('patch', () => {
    it('patch successfully', async () => {
      const item = await testUtils.saveItem({
        actor,
        item: { lang: 'fr', extra: { folder: {} } },
      });

      // noise
      const untouchedItem = await testUtils.saveItem({ actor });

      const newData = { lang: 'de', name: 'newname' };
      const newItem = await itemRepository.patch(item.id, newData);
      expectItem(newItem, { ...item, ...newData });
      expectItem(await testUtils.rawItemRepository.findOneBy({ id: item.id }), {
        ...item,
        ...newData,
      });
      expectItem(
        await testUtils.rawItemRepository.findOneBy({ id: untouchedItem.id }),
        untouchedItem,
      );
    });
    it('patch extra successfully', async () => {
      const item = await testUtils.saveItem({
        actor,
        item: {
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
      });
      const newData = {
        // correct data
        [ItemType.S3_FILE]: {
          content: 'hello',
        },
        // incorrect data
        document: { content: 'some content' },
      };
      const newItem = await itemRepository.patch(item.id, { extra: newData });
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
      expectItem(await testUtils.rawItemRepository.findOneBy({ id: item.id }), {
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
      const item = await testUtils.saveItem({ actor, item: { settings: { isCollapsible: true } } });
      const newData = {
        settings: {
          hasThumbnail: true,
        },
      };
      const newItem = await itemRepository.patch(item.id, newData);
      expectItem(newItem, { ...item, settings: { hasThumbnail: true, isCollapsible: true } });
      expectItem(await testUtils.rawItemRepository.findOneBy({ id: item.id }), {
        ...item,
        settings: { hasThumbnail: true, isCollapsible: true },
      });
    });
  });

  describe('post', () => {
    it('post successfully', async () => {
      const data = { name: 'name', type: ItemType.FOLDER };

      await itemRepository.post(data, actor);
      const newItem = await testUtils.rawItemRepository.findOne({
        where: { name: data.name },
        relations: { creator: true },
      });
      expect(newItem!.name).toEqual(data.name);
      expect(newItem!.type).toEqual(data.type);
      expect(newItem!.creator!.id).toEqual(actor.id);
    });
    it('post successfully with parent item', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const data = { name: 'name-1', type: ItemType.S3_FILE };

      await itemRepository.post(data, actor, parentItem);
      const newItem = await testUtils.rawItemRepository.findOne({
        where: { name: data.name },
        relations: { creator: true },
      });
      expect(newItem!.name).toEqual(data.name);
      expect(newItem!.type).toEqual(data.type);
      expect(newItem!.path).toContain(parentItem.path);
      expect(newItem!.creator!.id).toEqual(actor.id);
    });

    describe('getNextOrderCount', () => {
      it('return default value for no children', async () => {
        const parentItem = await testUtils.saveItem({ actor });
        expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(DEFAULT_ORDER);
      });
      it('no parent returns null', async () => {
        expect(await itemRepository.getNextOrderCount()).toBeNull();
      });
      it('return next values', async () => {
        const parentItem = await testUtils.saveItem({ actor });
        const item1 = await testUtils.saveItem({ actor, parentItem, item: { order: 10 } });
        expect(await itemRepository.getNextOrderCount(parentItem.path, item1.id)).toEqual(30);
        const item2 = await testUtils.saveItem({ actor, parentItem, item: { order: 22 } });
        expect(await itemRepository.getNextOrderCount(parentItem.path, item2.id)).toEqual(42);
        const item3 = await testUtils.saveItem({ actor, parentItem, item: { order: 45 } });
        expect(await itemRepository.getNextOrderCount(parentItem.path, item3.id)).toEqual(65);
      });
      it('return biggest value if no item id', async () => {
        const parentItem = await testUtils.saveItem({ actor });
        await testUtils.saveItem({ actor, parentItem, item: { order: 10 } });
        await testUtils.saveItem({ actor, parentItem, item: { order: 20 } });
        await testUtils.saveItem({ actor, parentItem, item: { order: 25 } });
        expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(45);
      });
    });
  });
  describe('copy', () => {
    it('copy successfully', async () => {
      const item = await testUtils.saveItem({ actor });
      const result = await itemRepository.copy(item, actor);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
    });
    it('copy successfully in parent', async () => {
      const originalParentItem = await testUtils.saveItem({ actor });
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem: originalParentItem });
      const result = await itemRepository.copy(item, actor, parentItem);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(copy.path).toContain(parentItem.path);
      expect(copy.path).not.toContain(originalParentItem.path);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
    });
    it('copy multiple times', async () => {
      // regession test for issue with statefull regular expression
      const item = await testUtils.saveItem({ actor });
      const result = await itemRepository.copy(item, actor);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);
      expect(copy.id).not.toEqual(item.id);
      expect(result.treeCopyMap.get(item.id)!.copy.id).toEqual(copy.id);
      expect(result.treeCopyMap.get(item.id)!.original.id).toEqual(item.id);
      const secondResult = await itemRepository.copy(copy, actor);
      const secondCopy = secondResult.copyRoot;
      expect(secondCopy.name).toEqual(`${item.name} (3)`);
      const thirdResult = await itemRepository.copy(secondCopy, actor);
      const thirdCopy = thirdResult.copyRoot;
      expect(thirdCopy.name).toEqual(`${item.name} (4)`);
    });
    it('cannot copy in non-folder', async () => {
      const parentItem = await testUtils.saveItem({ actor, item: { type: 'app' } });
      const item = await testUtils.saveItem({ actor });
      await expect(itemRepository.copy(item, actor, parentItem)).rejects.toBeInstanceOf(
        ItemNotFolder,
      );
    });
    it('copy suffix is updated', async () => {
      const item = await testUtils.saveItem({ actor });
      const result = await itemRepository.copy(item, actor);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(copy, actor);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name} (3)`);
    });

    it('copy name is not altered', async () => {
      const item = await testUtils.saveItem({ actor });
      item.name = '()(/\\)(..)() (a) (3) ';
      await itemRepository.patch(item.id, item);
      const result = await itemRepository.copy(item, actor);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name} (2)`);

      const result2 = await itemRepository.copy(copy, actor);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name} (3)`);
    });

    it('copy name do not exceed maximum length allowed.', async () => {
      const item = await testUtils.saveItem({ actor });
      item.name = faker.string.sample(MAX_ITEM_NAME_LENGTH);
      await itemRepository.patch(item.id, item);
      const result = await itemRepository.copy(item, actor);
      const copy = result.copyRoot;
      expect(copy.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (2)`);

      copy.name = `${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 4)} (9)`;
      await itemRepository.patch(copy.id, copy);
      const result2 = await itemRepository.copy(copy, actor);
      const copy2 = result2.copyRoot;
      expect(copy2.name).toEqual(`${item.name.substring(0, MAX_ITEM_NAME_LENGTH - 5)} (10)`);
    });
  });
  describe('getItemSumSize', () => {
    const itemType = ItemType.LOCAL_FILE;
    it('get sum for no item', async () => {
      const result = await itemRepository.getItemSumSize(actor.id, itemType);
      expect(result).toEqual(0);
    });
    it('get sum for many items', async () => {
      const item1 = await testUtils.saveItem({
        actor,
        item: LocalFileItemFactory() as unknown as Item,
      });
      const item2 = await testUtils.saveItem({
        actor,
        item: LocalFileItemFactory() as unknown as Item,
      });
      const item3 = await testUtils.saveItem({
        actor,
        item: LocalFileItemFactory() as unknown as Item,
      });

      // noise
      await testUtils.saveItem({
        actor,
      });

      const result = await itemRepository.getItemSumSize(actor.id, itemType);
      expect(result).toEqual(
        item1.extra[itemType].size + item2.extra[itemType].size + item3.extra[itemType].size,
      );
    });
  });
  describe('getAllPublishedItems', () => {
    it('get published items', async () => {
      const { items } = await testUtils.saveCollections(actor);
      const result = await itemRepository.getAllPublishedItems();
      expectManyItems(result, items);
    });
  });
  describe('getPublishedItemsForMember', () => {
    it('get published items for member', async () => {
      const { items } = await testUtils.saveCollections(actor);
      // noise
      const member = await saveMember();
      await testUtils.saveCollections(member);

      const result = await itemRepository.getPublishedItemsForMember(actor.id);
      expectManyItems(result, items);
    });
  });
  describe('getNextOrderCount', () => {
    it('get next order for empty path', async () => {
      expect(await itemRepository.getNextOrderCount()).toBeNull();
    });
    it('get next order for no children', async () => {
      const item = await testUtils.saveItem({ actor });
      expect(await itemRepository.getNextOrderCount(item.path)).toEqual(DEFAULT_ORDER);
    });
    it('get next order for one child', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      await testUtils.saveItem({ actor, parentItem, item: { order: 5 } });
      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(25);
    });
    it('get next order in between two children', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 30 } });
      await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      expect(await itemRepository.getNextOrderCount(parentItem.path, item.id)).toEqual(35);
    });
    it('get next order for last child', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      expect(await itemRepository.getNextOrderCount(parentItem.path, item.id)).toEqual(60);
    });
    it('no previous item id return latest order', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      expect(await itemRepository.getNextOrderCount(parentItem.path)).toEqual(60);
    });
  });
  describe('getFirstOrderValue', () => {
    it('get first order for empty path', async () => {
      expect(await itemRepository.getFirstOrderValue()).toBeNull();
    });
    it('get first order for no child', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      expect(await itemRepository.getFirstOrderValue(parentItem.path)).toEqual(DEFAULT_ORDER);
    });
    it('get first order for children', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      await testUtils.saveItem({ actor, parentItem, item: { order: 50 } });
      expect(await itemRepository.getFirstOrderValue(parentItem.path)).toEqual(20);
    });
  });
  describe('reorder', () => {
    it('no previous item reorder at first place', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 10 } });
      await itemRepository.reorder(item, parentItem.path);
      expect(await testUtils.getOrderForItemId(item.id)).toEqual(5);
    });
    it('reorder in one child will return smaller order', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 10 } });
      await itemRepository.reorder(item, parentItem.path);
      expect(await testUtils.getOrderForItemId(item.id)).toBeLessThan(10);
    });
    it('reorder in root returns null', async () => {
      const item = await testUtils.saveItem({ actor });
      await itemRepository.reorder(item, '');
      // cannot use findOne because order is null
      expect(await testUtils.getOrderForItemId(item.id)).toBeNull();
    });
    it('reorder in between children after previous item', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      const previousItem = await testUtils.saveItem({ actor, parentItem, item: { order: 50 } });
      await testUtils.saveItem({ actor, parentItem, item: { order: 70 } });
      await itemRepository.reorder(item, parentItem.path, previousItem.id);

      expect(await testUtils.getOrderForItemId(item.id)).toEqual(60);
    });
    it('reorder at the end after previous item', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const item = await testUtils.saveItem({ actor, parentItem, item: { order: 40 } });
      const previousItem = await testUtils.saveItem({ actor, parentItem, item: { order: 50 } });
      await itemRepository.reorder(item, parentItem.path, previousItem.id);
      expect(await testUtils.getOrderForItemId(item.id)).toEqual(70);
    });
  });
  describe('rescaleOrder', () => {
    it('rescale no children does no update', async () => {
      const parentItem = await testUtils.saveItem({ actor });
      const updateFn = jest.spyOn(testUtils.rawItemRepository, 'update');
      await itemRepository.rescaleOrder(parentItem);
      expect(updateFn).not.toHaveBeenCalled();
    });
    it('rescale children', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const item1 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.1 } });
      const item2 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.12 } });
      const item3 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.14 } });
      const item4 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.13 } });

      await itemRepository.rescaleOrder(parentItem);

      expect(await testUtils.getOrderForItemId(item1.id)).toEqual(20);
      expect(await testUtils.getOrderForItemId(item2.id)).toEqual(40);
      expect(await testUtils.getOrderForItemId(item3.id)).toEqual(80);
      expect(await testUtils.getOrderForItemId(item4.id)).toEqual(60);
    });
    it('rescale children for null values', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const item1 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.1 } });
      const item2 = await testUtils.saveItem({
        actor,
        parentItem,
        item: { createdAt: new Date(Date.now() - 1000), order: null },
      });
      const item3 = await testUtils.saveItem({ actor, parentItem, item: { order: 16 } });
      const item4 = await testUtils.saveItem({ actor, parentItem, item: { order: 13 } });
      const item5 = await testUtils.saveItem({
        actor,
        parentItem,
        item: { createdAt: new Date(Date.now()), order: null },
      });

      await itemRepository.rescaleOrder(parentItem);

      expect(await testUtils.getOrderForItemId(item1.id)).toEqual(20);
      // null value is at the end but before item5 because it is the least recent
      expect(await testUtils.getOrderForItemId(item2.id)).toEqual(80);
      expect(await testUtils.getOrderForItemId(item3.id)).toEqual(60);
      expect(await testUtils.getOrderForItemId(item4.id)).toEqual(40);
      // null value is at the end because it's the most recent
      expect(await testUtils.getOrderForItemId(item5.id)).toEqual(100);
    });
    it('rescale children for identical values', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const item1 = await testUtils.saveItem({ actor, parentItem, item: { order: 10.1 } });
      const item2 = await testUtils.saveItem({
        actor,
        parentItem,
        item: { createdAt: new Date(Date.now() - 1000), order: 3 },
      });
      const item3 = await testUtils.saveItem({ actor, parentItem, item: { order: 16 } });
      const item4 = await testUtils.saveItem({ actor, parentItem, item: { order: 13 } });
      const item5 = await testUtils.saveItem({
        actor,
        parentItem,
        item: { createdAt: new Date(Date.now()), order: 3 },
      });

      await itemRepository.rescaleOrder(parentItem);

      expect(await testUtils.getOrderForItemId(item1.id)).toEqual(60);
      // first among duplicata because is more recent
      expect(await testUtils.getOrderForItemId(item2.id)).toEqual(20);
      expect(await testUtils.getOrderForItemId(item3.id)).toEqual(100);
      expect(await testUtils.getOrderForItemId(item4.id)).toEqual(80);
      // second among duplicata because is less recent
      expect(await testUtils.getOrderForItemId(item5.id)).toEqual(40);
    });
    it('do not rescale if bigger than threshold', async () => {
      const parentItem = await testUtils.saveItem({ actor });

      const item1 = await testUtils.saveItem({ actor, parentItem, item: { order: 11 } });
      const item2 = await testUtils.saveItem({ actor, parentItem, item: { order: 12 } });
      const item3 = await testUtils.saveItem({ actor, parentItem, item: { order: 14 } });
      const item4 = await testUtils.saveItem({ actor, parentItem, item: { order: 13 } });

      await itemRepository.rescaleOrder(parentItem);

      expect(await testUtils.getOrderForItemId(item1.id)).toEqual(11);
      expect(await testUtils.getOrderForItemId(item2.id)).toEqual(12);
      expect(await testUtils.getOrderForItemId(item3.id)).toEqual(14);
      expect(await testUtils.getOrderForItemId(item4.id)).toEqual(13);
    });
  });
});
