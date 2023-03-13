import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import qs from 'qs';
import { Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  FolderItemType,
  HttpMethod,
  ItemType,
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TREE_LEVELS,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../test/constants';
import { expectItem, getDummyItem, saveItem, saveItems } from '../../../test/fixtures/items';
import * as MEMBERS_FIXTURES from '../../../test/fixtures/members';
import { saveItemAndMembership, saveMembership } from '../../../test/fixtures/memberships';
import {
  HierarchyTooDeep,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
  TooManyDescendants,
} from '../../util/graasp-error';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { Member } from '../member/entities/member';
import { Item } from './entities/Item';
import { ItemRepository } from './repository';
import { pathToId } from './utils';

// mock datasource
jest.mock('../../plugins/datasource');

const saveUntilMaxDescendants = async (parent: Item, actor: Member) => {
  // save maximum depth
  // TODO: DYNAMIC
  let currentParent = parent;
  for (let i = 0; i < MAX_TREE_LEVELS - 1; i++) {
    const newCurrentParent = await saveItem({
      item: getDummyItem({ type: ItemType.FOLDER }),
      actor,
      parentItem: currentParent,
    });
    currentParent = newCurrentParent;
  }
  // return last child
  return currentParent;
};

const saveNbOfItems = async ({
  nb,
  actor,
  parentItem,
}: {
  nb: number;
  actor: Member;
  parentItem?: Item;
}) => {
  const items: Item[] = [];
  for (let i = 0; i < nb; i++) {
    const { item } = await saveItemAndMembership({
      item: getDummyItem({ name: 'item ' + i }),
      member: actor,
      parentItem,
    });
    items.push(item);
  }
  return items;
};

describe('Item routes tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyItem();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = getDummyItem();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check item exists in db
        const item = await ItemRepository.get(newItem.id);
        expect(item?.id).toEqual(newItem.id);

        // a membership is created for this item
        const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Create successfully in parent item', async () => {
        const { item: parent } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem(),
        });
        const payload = getDummyItem();
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parent.id}`,
          payload,
        });
        const newItem = response.json();

        expectItem(newItem, payload, actor, parent);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // a membership does not need to be created for item with admin rights
        const nbItemMemberships = await ItemMembershipRepository.count();
        expect(nbItemMemberships).toEqual(1);
      });

      it('Create successfully in shared parent item', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({ member });
        await saveMembership({ member: actor, item: parent, permission: PermissionLevel.Write });
        const payload = getDummyItem({ type: ItemType.FOLDER });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parent.id}`,
          payload,
        });

        const newItem = response.json();
        expectItem(newItem, payload, actor, parent);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // a membership is created for this item
        // one membership for the owner
        // one membership for sharing
        // admin for the new item
        expect(await ItemMembershipRepository.count()).toEqual(3);
      });

      // TODO: schema create()
      it('Bad request if name is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = getDummyItem({ name: '' });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = getDummyItem({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload: newItem1,
        });
        expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      // TODO: schema
      it('Bad request if type is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = getDummyItem();
        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload: { ...newItem, type: 'invalid-type' },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      // TODO: schema
      it('Bad request if parentId id is invalid', async () => {
        const payload = getDummyItem({ type: ItemType.FOLDER });
        const parentId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot create item in non-existing parent', async () => {
        const payload = getDummyItem({ type: ItemType.FOLDER });
        const parentId = uuidv4();
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual('Not Found');
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Cannot create item if member does not have membership on parent', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({ item: getDummyItem(), member });
        const payload = getDummyItem({ type: ItemType.FOLDER });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
      });

      it('Cannot create item if member can only read parent', async () => {
        const owner = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({
          item: getDummyItem(),
          member: actor,
          creator: owner,
          permission: PermissionLevel.Read,
        });

        const payload = getDummyItem({ type: ItemType.FOLDER });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parent.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new MemberCannotWriteItem(parent.id));
      });

      it('Cannot create item if parent item has too many children', async () => {
        const { item: parent } = await saveItemAndMembership({
          item: getDummyItem(),
          member: actor,
        });
        const payload = getDummyItem({ type: ItemType.FOLDER });

        // save maximum children
        const items = Array.from({ length: MAX_NUMBER_OF_CHILDREN }, () =>
          getDummyItem({ type: ItemType.FOLDER, parentPath: parent.path }),
        );
        await saveItems({ items, parentItem: parent, actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${parent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new TooManyChildren());
      });

      it('Cannot create item if parent is too deep in hierarchy', async () => {
        const payload = getDummyItem({ type: ItemType.FOLDER });
        const { item: parent } = await saveItemAndMembership({
          item: getDummyItem({ type: ItemType.FOLDER }),
          member: actor,
        });
        const currentParent = await saveUntilMaxDescendants(parent, actor);

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items?parentId=${currentParent.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new HierarchyTooDeep());
      });
    });
  });
  describe('GET /items/:id', () => {
    // warning: this will change if it becomes a public endpoint
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ item: getDummyItem(), member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items/${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const { item } = await saveItemAndMembership({ item: getDummyItem(), member: actor });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectItem(returnedItem, item, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/invalid-id',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Not found for missing item given id', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${id}`,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get item if have no membership', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const item = await saveItem({ item: getDummyItem(), actor: member });
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${item.id}`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  // get many items
  describe('GET /items?id=<id>', () => {
    // warning: this will change if it becomes a public endpoint
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const items: Item[] = [];
        for (let i = 0; i < 3; i++) {
          const { item } = await saveItemAndMembership({ member: actor });
          items.push(item);
        }

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const { data, errors } = response.json();
        expect(errors).toHaveLength(0);
        items.forEach(({ id }) => {
          expectItem(
            data[id],
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });
      it('Returns one item successfully for valid item', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
        });

        expectItem(response.json().data[item.id], item);
        expect(response.json().errors).toHaveLength(0);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Bad request for one invalid item', async () => {
        const { item } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items?${qs.stringify({ id: [item.id, 'invalid-id'] }, { arrayFormat: 'repeat' })}`,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Returns one error for one missing item', async () => {
        const missingId = uuidv4();
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items?${qs.stringify(
            { id: [...items.map(({ id }) => id), missingId] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        const { data, errors } = response.json();
        items.forEach(({ id }) => {
          expectItem(
            data[id],
            items.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(data[missingId]).toBeFalsy();

        expect(errors).toContainEqual(new ItemNotFound(missingId));
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
  describe('GET /items/own', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/items/own',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const { item: item3 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2, item3];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/own',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const data = response.json();
        expect(data).toHaveLength(items.length);
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });
    });
  });
  describe('GET /items/shared-with', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/items/own',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let items;
      let member;

      beforeEach(async () => {
        ({ app, actor } = await build());

        member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: item1 } = await saveItemAndMembership({ member });
        const { item: item2 } = await saveItemAndMembership({ member });
        const { item: item3 } = await saveItemAndMembership({ member });
        items = [item1, item2, item3];
        await saveMembership({ item: item1, member: actor });
        await saveMembership({ item: item2, member: actor, permission: PermissionLevel.Write });
        await saveMembership({ item: item3, member: actor, permission: PermissionLevel.Read });

        // save own item that should not be returned
        await saveItemAndMembership({ item: getDummyItem(), member: actor });
      });

      it('Returns successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const data = response.json();
        expect(data).toHaveLength(items.length);
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });

      it('Returns successfully with read permission filter', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with?permission=read',
        });
        const data = response.json();
        expect(data).toHaveLength(items.length);
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns successfully with write permission filter', async () => {
        const validItems = items.slice(0, 2);
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with?permission=write',
        });
        const data = response.json();
        expect(data).toHaveLength(validItems.length);

        validItems.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            validItems.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns successfully with admin permission filter', async () => {
        const validItems = items.slice(0, 1);
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with?permission=admin',
        });
        const data = response.json();
        expect(data).toHaveLength(validItems.length);

        validItems.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            validItems.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns successfully shared siblings', async () => {
        // create siblings
        const { item: parentItem } = await saveItemAndMembership({ member });
        const { item: item1 } = await saveItemAndMembership({ member, parentItem });
        const { item: item2 } = await saveItemAndMembership({ member, parentItem });
        items = [item1, item2];
        await saveMembership({ item: item1, member: actor, permission: PermissionLevel.Read });
        await saveMembership({ item: item2, member: actor, permission: PermissionLevel.Write });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const data = response.json();
        // should at least contain both siblings
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });

      it('Should return only parent if parent and siblings are shared', async () => {
        // create siblings
        const { item: parentItem } = await saveItemAndMembership({ member });
        const { item: item1 } = await saveItemAndMembership({ member, parentItem });
        const { item: item2 } = await saveItemAndMembership({ member, parentItem });
        await saveMembership({ item: parentItem, member: actor, permission: PermissionLevel.Read });
        await saveMembership({ item: item1, member: actor, permission: PermissionLevel.Read });
        await saveMembership({ item: item2, member: actor, permission: PermissionLevel.Write });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/shared-with',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const data = response.json();
        // should contain parent but not children
        expectItem(
          data.find(({ id: thisId }) => thisId === parentItem.id),
          parentItem,
        );
        expect(data.find(({ id: thisId }) => thisId === item1.id)).toBeFalsy();
        expect(data.find(({ id: thisId }) => thisId === item2.id)).toBeFalsy();
      });
    });
  });
  describe('GET /items/:id/children', () => {
    // warning: this will change if the endpoint becomes public
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items/${item.id}/children`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: child1 } = await saveItemAndMembership({ member: actor, parentItem: parent });
        const { item: child2 } = await saveItemAndMembership({ member: actor, parentItem: parent });

        const children = [child1, child2];
        // create child of child
        await saveItemAndMembership({ item: getDummyItem(), member: actor, parentItem: child1 });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/children`,
        });

        const data = response.json();
        expect(data).toHaveLength(children.length);
        children.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            children.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns successfully empty children', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/children`,
        });

        expect(response.json()).toEqual([]);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns ordered children', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member: actor,
          parentItem: parent,
        });
        const { item: child2 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member: actor,
          parentItem: parent,
        });

        const childrenOrder = [child2.id, child1.id];
        const children = [child1, child2];

        await ItemRepository.patch(parent.id, { extra: { [ItemType.FOLDER]: { childrenOrder } } });
        // create child of child
        await saveItemAndMembership({ item: getDummyItem(), member: actor, parentItem: child1 });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/children?ordered=true`,
        });

        const data = response.json();
        expect(data).toHaveLength(children.length);
        // verify order and content
        data.forEach((item, idx) => {
          const child = children.find(({ id: thisId }) => thisId === childrenOrder[idx]);
          expectItem(item, child);
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns ordered successfully even without order defined', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member: actor,
          parentItem: parent,
        });
        const { item: child2 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member: actor,
          parentItem: parent,
        });

        const children = [child1, child2];

        // create child of child
        await saveItemAndMembership({ member: actor, parentItem: child1 });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/children?ordered=true`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        const data = response.json();
        expect(data).toHaveLength(children.length);
        children.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            children.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/invalid-id/children',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get children from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${id}/children`,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get children if does not have membership on parent', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({ member });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member,
          parentItem: parent,
        });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member,
          parentItem: parent,
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/children`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('GET /items/:id/descendants', () => {
    // warning: this will change if the endpoint becomes public
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items/${item.id}/descendants`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member: actor,
          parentItem: parent,
        });
        const { item: child2 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member: actor,
          parentItem: parent,
        });

        const { item: childOfChild } = await saveItemAndMembership({
          member: actor,
          parentItem: child1,
        });
        const descendants = [child1, child2, childOfChild];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/descendants`,
        });

        const data = response.json();
        expect(data).toHaveLength(descendants.length);
        descendants.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            descendants.find(({ id: thisId }) => thisId === id),
          );
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns successfully empty descendants', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });

        // another item with child
        const { item: parent1 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member: actor,
          parentItem: parent1,
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/descendants`,
        });

        expect(response.json()).toEqual([]);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/invalid-id/descendants',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get descendants from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${id}/descendants`,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get descendants if does not have membership on parent', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({ member });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member,
          parentItem: parent,
        });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member,
          parentItem: parent,
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/descendants`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Update successfully', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            extra: {
              [ItemType.FOLDER]: {
                extraValue: 'value',
              },
            },
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.FOLDER]: {
              childrenOrder: [uuidv4(), uuidv4()],
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          // BUG: folder extra should not contain extra
          extra: { folder:{...item.extra.folder,  ...payload.extra.folder} },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      // TODO: extra should be patch correctly
      // TODO: settins should be patch correctly

      it('Bad request if id is invalid', async () => {
        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: '/items/invalid-id',
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad Request if extra is invalid', async () => {
        const payload = {
          name: 'new name',
          extra: { key: 'false' },
        };
        const id = getDummyItem().id;
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });


      it('Cannot update not found item given id', async () => {
        const payload = {
          name: 'new name',
        };
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${id}`,
          payload,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot update item if does not have membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item } = await saveItemAndMembership({ member });
        await saveMembership({ item, member: actor, permission: PermissionLevel.Read });
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  // // update many items
  describe('PATCH /items', () => {
    const payload = {
      name: 'new name',
    };
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });
      const payload = { name: 'new name' };

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Update successfully', async () => {
        const items = await saveNbOfItems({ nb: 2, actor });

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await new Promise((res) => {
          setTimeout(async () => {
            const { data, errors } = await ItemRepository.getMany(items.map(({ id }) => id));
            Object.entries(data).forEach(([id, result]) => {
              const changes = { ...items.find(({ id: thisId }) => thisId === id), ...payload };
              expectItem(result, changes);
            });
            expect(Object.keys(data)).toHaveLength(items.length);
            expect(errors).toHaveLength(0);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Nothing updates if one item id is invalid', async () => {
        const missingItemId = uuidv4();
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?${qs.stringify(
            { id: [...items.map(({ id }) => id), missingItemId] },
            { arrayFormat: 'repeat' },
          )}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await new Promise((res) => {
          setTimeout(async () => {
            const { data, errors } = await ItemRepository.getMany(items.map(({ id }) => id));
            Object.entries(data).forEach(([id, result]) => {
              expectItem(
                result,
                items.find(({ id: thisId }) => thisId === id),
              );
            });
            expect(Object.keys(data)).toHaveLength(items.length);
            expect(errors).toHaveLength(0);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Bad Request for one invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?${qs.stringify(
            { id: [getDummyItem().id, 'invalid-id'] },
            { arrayFormat: 'repeat' },
          )}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad Request for invalid extra', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2];

        const payload1 = {
          name: 'new name',
          extra: { some: 'content' },
        };
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: payload1,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items/${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Delete successfully', async () => {
        const { item, itemMembership } = await saveItemAndMembership({ member: actor });
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const membership = await saveMembership({ item, member });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${item.id}`,
        });

        expectItem(response.json(), item);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // expect item and its membership to not exist in the tree
        expect(await ItemRepository.findOneBy({ id: item.id })).toBeFalsy();
        expect(await ItemMembershipRepository.findOneBy({ id: itemMembership.id })).toBeFalsy();
        expect(await ItemMembershipRepository.findOneBy({ id: membership.id })).toBeFalsy();
      });
      it('Delete successfully with children', async () => {
        const { item: anotherItem, itemMembership } = await saveItemAndMembership({
          member: actor,
        });
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: item1 } = await saveItemAndMembership({ member: actor, parentItem: parent });
        const { item: item2 } = await saveItemAndMembership({ member: actor, parentItem: parent });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${parent.id}`,
        });

        expectItem(response.json(), parent);
        expect(response.statusCode).toBe(StatusCodes.OK);

        const items = await ItemRepository.find();
        // only one random item still exists
        expect(items).toHaveLength(1);
        expect(items.find(({ id }) => id === anotherItem.id)).toBeTruthy();
        expect(items.find(({ id }) => id === parent.id)).toBeFalsy();
        expect(items.find(({ id }) => id === item1.id)).toBeFalsy();
        expect(items.find(({ id }) => id === item2.id)).toBeFalsy();

        // expect memberships to not exist in the tree
        const memberships = await ItemMembershipRepository.find({
          where: { id: Not(itemMembership.id) },
        });
        expect(memberships).toHaveLength(0);
      });
      it('Cannot delete too many descendants', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });

        const children = Array.from({ length: MAX_DESCENDANTS_FOR_DELETE + 1 }, () =>
          getDummyItem(),
        );
        await Promise.all(
          children.map((item) =>
            saveItemAndMembership({ item, member: actor, parentItem: parent }),
          ),
        );
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${parent.id}`,
        });

        expect(response.json()).toEqual(new TooManyDescendants(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  // // delete many items
  describe('DELETE /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Delete successfully', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor, parentItem: item1 });
        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(response.json()).toEqual(items.map(({ id }) => id));
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await new Promise((res) => {
          setTimeout(async () => {
            const remaining = await ItemRepository.find();
            expect(remaining).toHaveLength(0);
            const memberships = await ItemMembershipRepository.find();
            expect(memberships).toHaveLength(0);
            const { errors } = await ItemRepository.getMany(items.map(({ id }) => id));
            expect(errors).toHaveLength(items.length);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Delete successfully one item', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor, parentItem: item1 });
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items?${qs.stringify({ id: [item1.id] }, { arrayFormat: 'repeat' })}`,
        });

        expect(response.json()).toEqual([item1.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await new Promise((res) => {
          setTimeout(async () => {
            const remaining = await ItemRepository.find();
            expect(remaining).toHaveLength(0);

            const memberships = await ItemMembershipRepository.find();
            expect(memberships).toHaveLength(0);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Bad request if one id is invalid', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor, parentItem: item1 });
        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items?${qs.stringify(
            { id: [...items.map(({ id }) => id), 'invalid-id'] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Does not delete items if item does not exist', async () => {
        const missingId = uuidv4();
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor, parentItem: item1 });
        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items?${qs.stringify(
            { id: [...items.map(({ id }) => id), missingId] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // items should still exist
        await new Promise((res) => {
          setTimeout(async () => {
            const remaining = await ItemRepository.find();
            remaining.forEach(({ id }) => {
              expect(remaining.find(({ id: thisId }) => thisId === id)).toBeTruthy();
            });
            res(true);
          });
        });
      });
    });
  });
  describe('POST /items/:id/move', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/${item.id}/move`,
        payload: {
          parentId: item.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Move successfully to root', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const { item } = await saveItemAndMembership({ member: actor, parentItem });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a different path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(pathToId(result.path)).toEqual(result.id);
            res(true);
          });
        });
      });
      it('Move successfully to another parent', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const { item } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: { parentId: parentItem.id },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a different path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Bad Request if moved item id is invalid', async () => {
        const item = 'invalid-id';
        const { item: parent } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item}/move`,
          payload: {
            parentId: parent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      });
      it('Bad Request if target item id is invalid', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const targetItem = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {
            parentId: targetItem,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      });
      it('Cannot move if moved item does not exist', async () => {
        const item = uuidv4();
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const initialChildren = await ItemRepository.getChildren(parent);
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item}/move`,
          payload: {
            parentId: parent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const finalChildren = await ItemRepository.getChildren(parent);

            expect(initialChildren).toEqual(finalChildren);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Did not move if target item does not exist', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const targetItem = uuidv4();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {
            parentId: targetItem,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expectItem(result, item);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Fail to move root item to root', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expectItem(result, item);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Fail to move if moved item has too many descendants', async () => {
        const { item: itemToMove } = await saveItemAndMembership({ member: actor });
        const { item: targetItem } = await saveItemAndMembership({ member: actor });
        const children = Array.from({ length: MAX_DESCENDANTS_FOR_MOVE + 1 }, () => getDummyItem());
        await Promise.all(
          children.map((item) =>
            saveItemAndMembership({ item, member: actor, parentItem: itemToMove }),
          ),
        );

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${itemToMove.id}/move`,
          payload: {
            parentId: targetItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: itemToMove.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expectItem(result, itemToMove);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Fail to move parent in child', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item } = await saveItemAndMembership({ member: actor, parentItem: parent });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {
            parentId: parent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expectItem(result, item);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Cannot move if hierarchy is too deep', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const { item: parent } = await saveItemAndMembership({ member: actor });

        const currentParent = await saveUntilMaxDescendants(parent, actor);

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/move`,
          payload: {
            parentId: currentParent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have the same path
        await new Promise((res) => {
          setTimeout(async () => {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expectItem(result, item);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });
  });
  // // move many items
  describe('POST /items/move', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item: item1 } = await saveItemAndMembership({ member });
      const { item: item2 } = await saveItemAndMembership({ member });
      const { item: item3 } = await saveItemAndMembership({ member });
      const items = [item1, item2, item3];
      const { item: parent } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/move?${qs.stringify(
          { id: items.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
        payload: {
          parentId: parent.id,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Move successfully root item', async () => {
        const items = await saveNbOfItems({ nb: 3, actor });
        const { item: parent } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: parent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a different path
        await new Promise((res) => {
          setTimeout(async () => {
            for (const item of items) {
              const result = await ItemRepository.findOneBy({ id: item.id });
              if (!result) {
                throw new Error('item does not exist!');
              }
              expect(result.path.startsWith(parent.path)).toBeTruthy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      it('Move successfully items to root', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor, parentItem });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a differnt path
        await new Promise((res) => {
          setTimeout(async () => {
            for (const item of items) {
              const result = await ItemRepository.findOneBy({ id: item.id });
              if (!result) {
                throw new Error('item does not exist!');
              }
              expect(result.path.startsWith(parentItem.path)).toBeFalsy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      it('Move successfully items to another parent', async () => {
        const { item: originalParent } = await saveItemAndMembership({ member: actor });
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor, parentItem: originalParent });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: parentItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a differnt path
        await new Promise((res) => {
          setTimeout(async () => {
            for (const item of items) {
              const result = await ItemRepository.findOneBy({ id: item.id });
              if (!result) {
                throw new Error('item does not exist!');
              }
              expect(result.path.startsWith(parentItem.path)).toBeTruthy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Bad request if one id is invalid', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor, parentItem });
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: [...items.map(({ id }) => id), 'invalid-id'] },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {},
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Fail to move items if one item does not exist', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: [...items.map(({ id }) => id), uuidv4()] },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a differnt path
        await new Promise((res) => {
          setTimeout(async () => {
            for (const item of items) {
              const result = await ItemRepository.findOneBy({ id: item.id });
              if (!result) {
                throw new Error('item does not exist!');
              }
              expect(result.path.startsWith(parentItem.path)).toBeFalsy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Move lots of items', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: MAX_TARGETS_FOR_MODIFY_REQUEST, actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: parentItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            for (const item of items) {
              const result = await ItemRepository.findOneBy({ id: item.id });
              if (!result) {
                throw new Error('item does not exist!');
              }
              expect(result.path.startsWith(parentItem.path)).toBeTruthy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
    });
  });
  describe('POST /items/:id/copy', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/${item.id}/copy`,
        payload: {},
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      const name = 'item to duplicate';

      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Copy successfully in root', async () => {
        const { item } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/copy`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            const results = await ItemRepository.findBy({ name });
            if (!results.length) {
              throw new Error('item does not exist!');
            }
            expect(results).toHaveLength(2);
            expect(results[0].id).not.toEqual(results[1].id);
            expect(results[0].path).not.toEqual(results[1].path);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Copy successfully with correct order', async () => {
        const { item: parentItem } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });
        const children = await saveNbOfItems({ nb: 3, actor, parentItem });
        const childrenOrder = children.map(({ id }) => id).reverse();
        await ItemRepository.patch(parentItem.id, {
          extra: { [ItemType.FOLDER]: { childrenOrder } },
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${parentItem.id}/copy`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            const results = (await ItemRepository.findBy({ name })) as FolderItemType[];
            if (!results.length) {
              throw new Error('item does not exist!');
            }
            // check order is different and contains same nb of children
            const original = results.find(({ id }) => id === parentItem.id);
            expect(original?.extra.folder?.childrenOrder).toEqual(childrenOrder);
            const copy = results.find(({ id }) => id !== parentItem.id);
            expect(copy?.extra.folder?.childrenOrder).toHaveLength(childrenOrder.length);
            expect(copy?.extra.folder?.childrenOrder).not.toEqual(childrenOrder);

            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Bad Request if copied item id is invalid', async () => {
        const item = 'invalid-id';
        const { item: parentItem } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item}/copy`,
          payload: {
            parentId: parentItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      });
      it('Bad Request if target item id is invalid', async () => {
        const { item } = await saveItemAndMembership({ member: actor });

        const targetItem = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/copy`,
          payload: {
            parentId: targetItem,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toBe(ReasonPhrases.BAD_REQUEST);
      });
      it('Fail to copy if moved item does not exist', async () => {
        const item = uuidv4();
        const { item: targetItem } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item}/move`,
          payload: {
            parentId: targetItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // no new item
            const results = await ItemRepository.find();
            expect(results).toHaveLength(1);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Cannot copy if target item does not exist', async () => {
        const targetItem = uuidv4();
        const { item } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/copy`,
          payload: {
            parentId: targetItem,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // no new item
            const results = await ItemRepository.find();
            expect(results).toHaveLength(1);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Cannot copy if copied item has too many descendants', async () => {
        const { item } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });
        const { item: parent } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });
        const children = Array.from({ length: MAX_DESCENDANTS_FOR_COPY + 1 }, () => getDummyItem());
        await Promise.all(
          children.map((item) =>
            saveItemAndMembership({ item, member: actor, parentItem: parent }),
          ),
        );

        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${parent.id}/copy`,
          payload: {
            parentId: item.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // no new item
            const newCount = await ItemRepository.count();
            expect(newCount).toEqual(initialCount);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Cannot copy if hierarchy is too deep', async () => {
        const { item } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name }),
        });
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const lastParent = await saveUntilMaxDescendants(parent, actor);
        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/copy`,
          payload: {
            parentId: lastParent.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // no new item
            const newCount = await ItemRepository.count();
            expect(newCount).toEqual(initialCount);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
    });
  });
  // // copy many items
  describe('POST /items/copy', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/copy?${qs.stringify({ id: [item.id] }, { arrayFormat: 'repeat' })}`,
        payload: {},
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      const name = 'item to duplicate';

      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Copy successfully from root to item', async () => {
        const { item: targetItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor });
        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: targetItem.id,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // contains twice the items (and the target item)
            const newCount = await ItemRepository.count();
            expect(newCount).toEqual(initialCount + items.length);
            for (const { name } of items) {
              const itemsInDb = await ItemRepository.findBy({ name });
              expect(itemsInDb).toHaveLength(2);
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Copy successfully from item to root', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor, parentItem });
        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // contains twice the items (and the target item)
            const newCount = await ItemRepository.count();
            expect(newCount).toEqual(initialCount + items.length);
            for (const { name } of items) {
              const itemsInDb = await ItemRepository.findBy({ name });
              expect(itemsInDb).toHaveLength(2);
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });

      it('Bad request if one id is invalid', async () => {
        const items = await saveNbOfItems({ nb: 3, actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify(
            { id: [...items.map(({ id }) => id), 'invalid-id'] },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {},
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to copy if one item does not exist', async () => {
        const items = await saveNbOfItems({ nb: 3, actor });
        const missingId = uuidv4();
        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify(
            { id: [...items.map(({ id }) => id), missingId] },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            // contains twice the items (and the target item)
            const newCount = await ItemRepository.count();
            expect(newCount).toEqual(initialCount);
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
      it('Copy lots of items', async () => {
        const items = await saveNbOfItems({ nb: MAX_TARGETS_FOR_MODIFY_REQUEST, actor });
        const { item: parentItem } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify(
            { id: items.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
          payload: {
            parentId: parentItem.id,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await new Promise((res) =>
          setTimeout(async () => {
            for (const item of items) {
              const results = await ItemRepository.findBy({ name: item.name });
              if (!results.length) {
                throw new Error('item does not exist!');
              }
              expect(results).toHaveLength(2);
              const copy = results.find(({ id }) => id !== item.id);
              expect(copy?.path.startsWith(parentItem.path)).toBeTruthy();
            }
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME),
        );
      });
    });
  });
});
