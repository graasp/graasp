import { StatusCodes } from 'http-status-codes';
import qs from 'qs';
import { v4 } from 'uuid';

import { HttpMethod, ItemTagType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { BOB, saveMember } from '../../../../test/fixtures/members';
import { saveItemAndMembership } from '../../../../test/fixtures/memberships';
import { ItemNotFound, MemberCannotAccess } from '../../../util/graasp-error';
import { ITEMS_ROUTE } from '../../item/plugins/thumbnail/utils/constants';
import { ItemTag } from '../ItemTag';
import { ItemTagRepository } from '../repository';
import {
  CannotModifyParentTag,
  ConflictingTagsInTheHierarchy,
  ItemHasTag,
  ItemTagNotFound,
} from '../util/graasp-item-tags-error';
import { ITEM_TAGS, TAGS } from './constants';

// mock datasource
jest.mock('../../../plugins/datasource');

const saveTagsForItem = async ({ item, creator }) => {
  const itemTags: ItemTag[] = [];
  itemTags.push(await ItemTagRepository.save({ item, creator, type: ItemTagType.HIDDEN }));
  itemTags.push(await ItemTagRepository.save({ item, creator, type: ItemTagType.PINNED }));

  return itemTags;
};

const expectItemTags = async (itemTags, correctItemTags) => {
  expect(itemTags).toHaveLength(correctItemTags.length);

  for (const it of itemTags) {
    const correctValue = correctItemTags.find(({ id }) => id === it.id);
    expect(it.type).toEqual(correctValue.type);
  }
};

describe('Tags', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:itemId/tags', () => {
    let item, member;

    describe('Signed Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
      });

      it('Throws if item is private', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/${item.id}/tags`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Returns successfully if item is public', async () => {
        const itemTag = await ItemTagRepository.save({
          item,
          creator: member,
          type: ItemTagType.PUBLIC,
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/${item.id}/tags`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemTags(res.json(), [itemTag]);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get tags of an item', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const itemTags = await saveTagsForItem({ item, creator: actor });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/${item.id}/tags`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemTags(res.json(), itemTags);
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/invalid-id/tags`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throw if item does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/${v4()}/tags`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('GET /tags?id=<id>&id<id>', () => {
    describe('Signed Out', () => {
      let item, member;

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
      });

      it('Throws if item is private', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?id=${item.id}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Returns successfully if item is public', async () => {
        const itemTag = await ItemTagRepository.save({
          item,
          creator: member,
          type: ItemTagType.PUBLIC,
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?id=${item.id}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        for (const tags of Object.values(res.json().data)) {
          expectItemTags(tags, [itemTag]);
        }
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Get tags for a single item', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const itemTags = await saveTagsForItem({ item, creator: actor });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?id=${item.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemTags(res.json().data[item.id], itemTags);
      });

      it('Get tags for multiple items', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const itemTags1 = await saveTagsForItem({ item: item1, creator: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const itemTags2 = await saveTagsForItem({ item: item2, creator: actor });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?${qs.stringify(
            { id: [item1.id, item2.id] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const tags1 = res.json().data[item1.id];
        expectItemTags(tags1, itemTags1);
        const tags2 = res.json().data[item2.id];
        expectItemTags(tags2, itemTags2);
      });

      it('Bad request if item id is invalid', async () => {
        const ids = ['invalid-id', v4()];
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?${qs.stringify({ id: ids }, { arrayFormat: 'repeat' })}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if one item does not exist', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        await saveTagsForItem({ item, creator: actor });
        const ids = [item.id, v4()];
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?${qs.stringify({ id: ids }, { arrayFormat: 'repeat' })}`,
        });

        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if does not have rights on one item', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const member = await saveMember(BOB);
        const { item: item2 } = await saveItemAndMembership({ member });
        const ids = [item1.id, item2.id];

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE}/tags?${qs.stringify({ id: ids }, { arrayFormat: 'repeat' })}`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });

  describe('POST /:itemId/tags', () => {
    let item;
    const type = ItemTagType.PUBLIC;

    describe('Signed Out', () => {
      let member;

      it('Throws if item is private', async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${type}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create a tag for an item', async () => {
        ({ item } = await saveItemAndMembership({ member: actor }));

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(type);
      });

      it('Cannot create tag if exists for item', async () => {
        ({ item } = await saveItemAndMembership({ member: actor }));
        await ItemTagRepository.save({ item, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${type}`,
        });
        expect(res.json()).toMatchObject(new ConflictingTagsInTheHierarchy(expect.anything()));
      });

      it('Cannot create tag if exists on parent', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        ({ item } = await saveItemAndMembership({ member: actor, parentItem: parent }));
        await ItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${type}`,
        });
        expect(res.json()).toMatchObject(new ConflictingTagsInTheHierarchy(expect.anything()));
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/invalid-id/tags/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${v4()}/tags/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE}/${v4()}/tags/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/tags/:id', () => {
    let item, itemTags;
    const type = ItemTagType.PUBLIC;

    describe('Signed Out', () => {
      let member;

      it('Throws if item is private', async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/${v4()}/tags/${type}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let toDelete;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
        itemTags = await saveTagsForItem({ item, creator: actor });
        toDelete = itemTags[1];
      });

      it('Delete a tag of an item (and descendants)', async () => {
        const { item: child } = await saveItemAndMembership({ member: actor, parentItem: item });
        const childTags = await saveTagsForItem({ item: child, creator: actor });
        const descendantToDelete = childTags.find(({ type }) => type === toDelete.type);

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${toDelete.type}`,
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemTag = await ItemTagRepository.findOneBy({ id: toDelete.id });
        expect(itemTag).toBeNull();
        const childItemTag = await ItemTagRepository.findOneBy({ id: descendantToDelete!.id });
        expect(childItemTag).toBeNull();
      });
      it('Cannot delete inherited tag', async () => {
        const { item: parent } = await saveItemAndMembership({ member: actor });
        ({ item } = await saveItemAndMembership({ member: actor, parentItem: parent }));
        const tag = await ItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/${item.id}/tags/${tag.type}`,
        });
        expect(res.json()).toMatchObject(new CannotModifyParentTag(expect.anything()));
      });
      it('Throws if tag does not exist', async () => {
        const { item: itemWithoutTag } = await saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/${itemWithoutTag.id}/tags/${ItemTagType.PINNED}`,
        });
        expect(res.json()).toMatchObject(new ItemTagNotFound(expect.anything()));
      });
      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/invalid-id/tags/${ItemTagType.PINNED}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad request if item tag id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE}/${v4()}/tags/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
