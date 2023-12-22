import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import qs from 'qs';
import { v4 as uuidv4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import {
  FolderItemExtra,
  HttpMethod,
  ItemTagType,
  ItemType,
  MAX_NUMBER_OF_CHILDREN,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TREE_LEVELS,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../test/constants';
import {
  HierarchyTooDeep,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotWriteItem,
  TooManyChildren,
} from '../../../utils/errors';
import { ItemMembershipRepository } from '../../itemMembership/repository';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../itemMembership/test/fixtures/memberships';
import { Member } from '../../member/entities/member';
import * as MEMBERS_FIXTURES from '../../member/test/fixtures/members';
import { Item } from '../entities/Item';
import { ItemTagRepository } from '../plugins/itemTag/repository';
import { ItemRepository } from '../repository';
import { SortBy } from '../types';
import {
  expectItem,
  expectManyItems,
  getDummyItem,
  saveItem,
  saveItems,
  savePublicItem,
} from './fixtures/items';

// mock datasource
jest.mock('../../../plugins/datasource');

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
  member,
}: {
  member?: Member;
  nb: number;
  actor: Member;
  parentItem?: Item;
}) => {
  const items: Item[] = [];
  for (let i = 0; i < nb; i++) {
    const { item } = await saveItemAndMembership({
      item: getDummyItem({ name: 'item ' + i }),
      member: member ?? actor,
      parentItem,
      creator: actor,
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

        const updatedParent = await ItemRepository.get(parent.id);
        // check parent has been updated
        expect(updatedParent.extra).toEqual({ folder: { childrenOrder: [newItem.id] } });

        // a membership does not need to be created for item with admin rights
        const nbItemMemberships = await ItemMembershipRepository.count();
        expect(nbItemMemberships).toEqual(1);
      });

      it('Create successfully in legacy parent item', async () => {
        const { item: parent } = await saveItemAndMembership({
          member: actor,
          // hack to simulate a legacy folder item that had an empty extra (no folder.childrenOrder)
          item: { ...getDummyItem(), extra: {} as FolderItemExtra },
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

        const updatedParent = await ItemRepository.get(parent.id);
        // check parent has been updated
        expect(updatedParent.extra).toEqual({ folder: { childrenOrder: [newItem.id] } });

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
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ item: getDummyItem(), member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items/${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
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

    describe('Public', () => {
      it('Returns successfully', async () => {
        ({ app } = await build({ member: null }));
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const item = await savePublicItem({ item: getDummyItem(), actor: member });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${item.id}`,
        });

        const returnedItem = response.json();
        expectItem(returnedItem, item, actor);
        expect(response.statusCode).toBe(StatusCodes.OK);
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
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().errors[0]).toMatchObject(new MemberCannotAccess(item.id));
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

    describe('Public', () => {
      it('Returns successfully', async () => {
        ({ app } = await build({ member: null }));
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const items: Item[] = [];
        for (let i = 0; i < 3; i++) {
          const item = await savePublicItem({ item: getDummyItem(), actor: member });
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
  describe('GET /items/accessible', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/items/accessible',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully owned and shared items', async () => {
        // owned items
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const { item: item3 } = await saveItemAndMembership({ member: actor });

        // shared
        const bob = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: item4 } = await saveItemAndMembership({ member: actor, creator: bob });
        const { item: item5 } = await saveItemAndMembership({ member: bob });
        const { item: item6 } = await saveItemAndMembership({
          member: actor,
          creator: bob,
          parentItem: item5,
        });

        // should not return these items
        await saveItemAndMembership({ member: bob });
        await saveItemAndMembership({ member: actor, parentItem: item1 });
        await saveItemAndMembership({ member: actor, parentItem: item4 });

        const items = [item1, item2, item3, item4, item6];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/accessible',
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });

      it('Returns successfully items for member id', async () => {
        await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({ member: actor });

        const bob = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: item1 } = await saveItemAndMembership({ member: actor, creator: bob });
        const { item: item2 } = await saveItemAndMembership({ member: actor, creator: bob });

        const items = [item1, item2];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?creatorId=${bob.id}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);
        items.forEach(({ id }) => {
          expectItem(
            data.find(({ id: thisId }) => thisId === id),
            items.find(({ id: thisId }) => thisId === id),
          );
        });
      });

      it('Returns successfully sorted items by name asc', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor, item: { name: '2' } });
        const { item: item2 } = await saveItemAndMembership({ member: actor, item: { name: '3' } });
        const { item: item3 } = await saveItemAndMembership({ member: actor, item: { name: '1' } });

        const items = [item3, item1, item2];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?sortBy=${SortBy.ItemName}&ordering=asc`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);
        items.forEach((_, idx) => {
          expectItem(data[idx], items[idx]);
        });
      });

      it('Returns successfully sorted items by type desc', async () => {
        const { item: item1 } = await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.DOCUMENT },
        });
        const { item: item2 } = await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.FOLDER },
        });
        const { item: item3 } = await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.APP },
        });

        const items = [item2, item1, item3];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?sortBy=${SortBy.ItemType}&ordering=desc`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);
        items.forEach((_, idx) => {
          expectItem(data[idx], items[idx]);
        });
      });

      it('Returns successfully sorted items by creator name asc', async () => {
        const bob = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: item1 } = await saveItemAndMembership({
          member: actor,
          creator: bob,
          item: { type: ItemType.DOCUMENT },
        });
        const { item: item2 } = await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.FOLDER },
        });
        const { item: item3 } = await saveItemAndMembership({
          member: actor,
          creator: bob,
          item: { type: ItemType.APP },
        });

        const items = [item2, item1, item3];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?sortBy=${SortBy.ItemCreatorName}&ordering=asc`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(items.length);
        expect(data).toHaveLength(items.length);
        items.forEach((_, idx) => {
          expectItem(data[idx], items[idx]);
        });
      });

      it('Throws for wrong sort by', async () => {
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.DOCUMENT },
        });
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.FOLDER },
        });
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.APP },
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?sortBy=dontexist&ordering=desc`,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws for wrong ordering', async () => {
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.DOCUMENT },
        });
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.FOLDER },
        });
        await saveItemAndMembership({
          member: actor,
          item: { type: ItemType.APP },
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/accessible?sortBy=${SortBy.ItemName}&ordering=nimp`,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Returns successfully paginated items', async () => {
        await saveItemAndMembership({ member: actor, item: { name: '2' } });
        await saveItemAndMembership({ member: actor, item: { name: '1' } });
        const { item } = await saveItemAndMembership({ member: actor, item: { name: '3' } });

        const response = await app.inject({
          method: HttpMethod.GET,
          // add sorting for result to be less flacky
          url: `/items/accessible?ordering=asc&sortBy=${SortBy.ItemName}&pageSize=1&page=3`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const { data, totalCount } = response.json();
        expect(totalCount).toEqual(3);
        expect(data).toHaveLength(1);
        expectItem(data[0], item);
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

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
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
      it('Filter out hidden children on read permission', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({
          member: actor,
          creator: member,
          permission: PermissionLevel.Read,
        });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member,
          parentItem: parent,
        });
        const { item: child2 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member,
          parentItem: parent,
        });
        await ItemTagRepository.save({ item: child1, creator: actor, type: ItemTagType.Hidden });

        const children = [child2];

        // create child of child that shouldn't be returned
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

    describe('Public', () => {
      it('Returns successfully', async () => {
        ({ app } = await build({ member: null }));
        const actor = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const parent = await savePublicItem({ item: getDummyItem(), actor });
        const child1 = await savePublicItem({ item: getDummyItem(), actor, parentItem: parent });
        const child2 = await savePublicItem({ item: getDummyItem(), actor, parentItem: parent });

        const children = [child1, child2];
        // create child of child
        await savePublicItem({ item: getDummyItem(), actor, parentItem: child1 });

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

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
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
      it('Filter out hidden items for read rights', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: parent } = await saveItemAndMembership({
          member: actor,
          creator: member,
          permission: PermissionLevel.Read,
        });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member,
          parentItem: parent,
        });
        const { item: child2 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member,
          parentItem: parent,
        });
        await ItemTagRepository.save({ item: child1, creator: member, type: ItemTagType.Hidden });

        await saveItemAndMembership({
          member,
          parentItem: child1,
        });
        const descendants = [child2];

        // another item with child
        const { item: parent1 } = await saveItemAndMembership({ member: actor });
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child' }),
          member: actor,
          parentItem: parent1,
        });

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${parent.id}/descendants`,
        });

        const result = response.json();
        expectManyItems(result, descendants);
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

    describe('Public', () => {
      it('Returns successfully', async () => {
        const actor = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        ({ app } = await build({ member: null }));
        const parent = await savePublicItem({ item: getDummyItem(), actor });
        const child1 = await savePublicItem({
          item: getDummyItem({ name: 'child1' }),
          actor,
          parentItem: parent,
        });
        const child2 = await savePublicItem({
          item: getDummyItem({ name: 'child2' }),
          actor,
          parentItem: parent,
        });

        const childOfChild = await savePublicItem({
          item: getDummyItem({ name: 'child3' }),
          actor,
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
    });
  });

  describe('GET /items/:id/parents', () => {
    it('Throws if signed out and item is private', async () => {
      ({ app } = await build({ member: null }));
      const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/items/${item.id}/parents`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully in order', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        const { item: child1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'child1' }),
          member: actor,
          parentItem: parent,
        });
        // noise
        await saveItemAndMembership({
          item: getDummyItem({ name: 'child2' }),
          member: actor,
          parentItem: parent,
        });

        const { item: childOfChild } = await saveItemAndMembership({
          member: actor,
          parentItem: child1,
        });
        const parents = [parent, child1];

        // patch item to force reorder
        await ItemRepository.patch(parent.id, { name: 'newname' });
        parent.name = 'newname';

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${childOfChild.id}/parents`,
        });

        const data = response.json();
        expect(data).toHaveLength(parents.length);
        data.forEach((p, idx) => {
          expectItem(p, parents[idx]);
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Returns successfully empty parents', async () => {
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
          url: `/items/${parent.id}/parents`,
        });

        expect(response.json()).toEqual([]);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Bad Request for invalid id', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: '/items/invalid-id/parents',
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Cannot get parents from unexisting item', async () => {
        const id = uuidv4();
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${id}/parents`,
        });

        expect(response.json()).toEqual(new ItemNotFound(id));
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot get parents if does not have membership on parent', async () => {
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
          url: `/items/${parent.id}/parents`,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(parent.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Public', () => {
      it('Returns successfully', async () => {
        ({ app } = await build({ member: null }));
        const parent = await savePublicItem({ item: getDummyItem(), actor });
        const child1 = await savePublicItem({
          item: getDummyItem({ name: 'child1' }),
          actor,
          parentItem: parent,
        });

        const childOfChild = await savePublicItem({
          item: getDummyItem({ name: 'child3' }),
          actor,
          parentItem: child1,
        });

        // noise
        await savePublicItem({
          item: getDummyItem({ name: 'child2' }),
          actor,
          parentItem: parent,
        });

        const parents = [parent, child1];

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `/items/${childOfChild.id}/parents`,
        });

        const data = response.json();
        expect(data).toHaveLength(parents.length);
        data.forEach((p, idx) => {
          expectItem(p, parents[idx]);
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
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
                childrenOrder: ['value'],
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
            hasThumbnail: true,
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
          extra: {
            folder: {
              ...item.extra[item.type],
              ...payload.extra.folder,
            },
          },
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
  // update many items
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
        method: HttpMethod.PATCH,
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
        await waitForExpect(async () => {
          const { data, errors } = await ItemRepository.getMany(items.map(({ id }) => id));
          Object.entries(data).forEach(([id, result]) => {
            const changes = { ...items.find(({ id: thisId }) => thisId === id), ...payload };
            expectItem(result, changes);
          });
          expect(Object.keys(data)).toHaveLength(items.length);
          expect(errors).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          const { data, errors } = await ItemRepository.getMany(items.map(({ id }) => id));
          Object.entries(data).forEach(([id, result]) => {
            expectItem(
              result,
              items.find(({ id: thisId }) => thisId === id),
            );
          });
          expect(Object.keys(data)).toHaveLength(items.length);
          expect(errors).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
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

  // delete many items
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
        await waitForExpect(async () => {
          const remaining = await ItemRepository.find();
          expect(remaining).toHaveLength(0);
          const memberships = await ItemMembershipRepository.find();
          expect(memberships).toHaveLength(0);
          const { errors } = await ItemRepository.getMany(items.map(({ id }) => id));
          expect(errors).toHaveLength(items.length);
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          const remaining = await ItemRepository.find();
          expect(remaining).toHaveLength(0);

          const memberships = await ItemMembershipRepository.find();
          expect(memberships).toHaveLength(0);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
      it('Delete successfully one item in parent, with children and memberships', async () => {
        // root with membership for two members
        const { item: root } = await saveItemAndMembership({ member: actor });
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        await saveMembership({ member, item: root });

        // parent to delete and its child
        const { item: parent } = await saveItemAndMembership({ member: actor, parentItem: root });
        await saveItemAndMembership({ member: actor, parentItem: parent });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items?${qs.stringify({ id: [parent.id] }, { arrayFormat: 'repeat' })}`,
        });

        expect(response.json()).toEqual([parent.id]);
        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(async () => {
          const remaining = await ItemRepository.find();
          // should keep root
          expect(remaining).toHaveLength(1);

          const memberships = await ItemMembershipRepository.find();
          // should keep root membership for actor and member
          expect(memberships).toHaveLength(2);

          // ws should not fail
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          const remaining = await ItemRepository.find();
          remaining.forEach(({ id }) => {
            expect(remaining.find(({ id: thisId }) => thisId === id)).toBeTruthy();
          });
        });
      });
    });
  });

  // move many items
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

      it('Move successfully root item to parent', async () => {
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
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parent.path)).toBeTruthy();

            // membership should have been deleted because has admin rights on parent
            const im = await ItemMembershipRepository.findOneBy({
              item: { path: buildPathFromIds(parent.id, item.id) },
            });
            expect(im).toBeNull();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeFalsy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Move successfully item to root and create new membership', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        // manually save item that doesn't need a membership because of inheritance
        const data = getDummyItem();
        data.path = buildPathFromIds(parentItem.id, data.id);
        const item = await ItemRepository.save({ ...data, creator: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: item.id }, { arrayFormat: 'repeat' })}`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a different path
        await waitForExpect(async () => {
          const result = await ItemRepository.findOneBy({ id: item.id });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeFalsy();

          // membership should have been created
          const im = await ItemMembershipRepository.findOneBy({
            item: { path: buildPathFromIds(item.id) },
          });
          if (!im) {
            throw new Error('item membership does not exist!');
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Move successfully item to child and delete same membership', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const { item } = await saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: item.id }, { arrayFormat: 'repeat' })}`,
          payload: { parentId: parentItem.id },
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // item should have a different path
        await waitForExpect(async () => {
          const result = await ItemRepository.findOneBy({ id: item.id });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(parentItem.path)).toBeTruthy();

          // membership should have been deleted
          const im = await ItemMembershipRepository.findOneBy({
            item: { path: buildPathFromIds(item.id) },
          });
          expect(im).toBeNull();
        }, MULTIPLE_ITEMS_LOADING_TIME);
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

        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
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

        // item should have a different path
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeFalsy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          for (const item of items) {
            const result = await ItemRepository.findOneBy({ id: item.id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
    });
  });

  // copy many items
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
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Copy successfully from root to root', async () => {
        const items = await saveNbOfItems({ nb: 3, actor });
        const initialCount = await ItemRepository.count();
        const initialCountMembership = await ItemMembershipRepository.count();

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
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount + items.length);
          for (const { name } of items) {
            const itemsInDb = await ItemRepository.findBy({ name });
            expect(itemsInDb).toHaveLength(2);
          }

          // check it created a new membership per item
          const newCountMembership = await ItemMembershipRepository.count();
          expect(newCountMembership).toEqual(initialCountMembership + items.length);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Copy successfully from root to item with admin rights', async () => {
        const { item: targetItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor });
        const initialCountMembership = await ItemMembershipRepository.count();
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
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount + items.length);
          for (const { name } of items) {
            const itemsInDb = await ItemRepository.findBy({ name });
            expect(itemsInDb).toHaveLength(2);
          }

          // check it did not create a new membership because user is admin of parent
          const newCountMembership = await ItemMembershipRepository.count();
          expect(newCountMembership).toEqual(initialCountMembership);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Copy successfully from root to item with write rights', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item: targetItem } = await saveItemAndMembership({
          member: actor,
          creator: member,
          permission: PermissionLevel.Write,
        });
        const items = await saveNbOfItems({ nb: 3, actor: member, member: actor });
        const initialCountMembership = await ItemMembershipRepository.count();
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
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount + items.length);
          for (const { name } of items) {
            const itemsInDb = await ItemRepository.findBy({ name });
            expect(itemsInDb).toHaveLength(2);
          }

          // check it created a new membership because user is writer of parent
          const newCountMembership = await ItemMembershipRepository.count();
          expect(newCountMembership).toEqual(initialCountMembership + items.length);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Copy successfully root item from shared items to home', async () => {
        const member = await MEMBERS_FIXTURES.saveMember(MEMBERS_FIXTURES.BOB);
        const { item } = await saveItemAndMembership({
          member: actor,
          creator: member,
          permission: PermissionLevel.Admin,
        });
        const { item: youngParent } = await saveItemAndMembership({
          item: getDummyItem({ name: 'young parent' }),
          member: actor,
          creator: member,
          permission: PermissionLevel.Admin,
          parentItem: item,
        });
        // children, saved in weird order (children updated first so it appears first when fetching)
        await saveItemAndMembership({
          item: getDummyItem({ name: 'old child' }),
          member: actor,
          creator: member,
          permission: PermissionLevel.Admin,
          parentItem: youngParent,
        });
        await saveItemAndMembership({
          member: actor,
          creator: member,
          permission: PermissionLevel.Admin,
          parentItem: item,
        });

        await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${youngParent.id}`,
          payload: {
            name: 'new name',
          },
        });

        const initialCountMembership = await ItemMembershipRepository.count();
        const initialCount = await ItemRepository.count();

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify({ id: item.id }, { arrayFormat: 'repeat' })}`,
          payload: {},
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait a bit for tasks to complete
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount * 2);

          // check it created a new membership because user is writer of parent
          const newCountMembership = await ItemMembershipRepository.count();
          expect(newCountMembership).toEqual(initialCountMembership + 1);
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });

      it('Copy successfully from item to root', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const items = await saveNbOfItems({ nb: 3, actor, parentItem });
        const initialCount = await ItemRepository.count();
        const initialCountMembership = await ItemMembershipRepository.count();

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
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount + items.length);
          for (const { name } of items) {
            const itemsInDb = await ItemRepository.findBy({ name });
            expect(itemsInDb).toHaveLength(2);
          }

          // check it did not create a new membership because user is admin of parent
          const newCountMembership = await ItemMembershipRepository.count();
          expect(newCountMembership).toEqual(initialCountMembership + items.length);
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          // contains twice the items (and the target item)
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount);
        }, MULTIPLE_ITEMS_LOADING_TIME);
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
        await waitForExpect(async () => {
          for (const item of items) {
            const results = await ItemRepository.findBy({ name: item.name });
            if (!results.length) {
              throw new Error('item does not exist!');
            }
            expect(results).toHaveLength(2);
            const copy = results.find(({ id }) => id !== item.id);
            expect(copy?.path.startsWith(parentItem.path)).toBeTruthy();
          }
        }, MULTIPLE_ITEMS_LOADING_TIME);
      });
    });
  });
});
