import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import {  HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { ItemRepository } from '../../repository';
import { expectItem, getDummyItem } from '../../test/fixtures/items';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { EmbeddedLinkItemExtra } from '.';
import { BOB, saveMember } from '../../../member/test/fixtures/members';

// mock datasource
jest.mock('../../../../plugins/datasource');

const extra = {
  [ItemType.LINK]: {
    url: 'http://myurl.com',
  },
} as EmbeddedLinkItemExtra;

// TODO: test iframely

describe('Link Item tests', () => {
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

      const payload = getDummyItem({ type: ItemType.LINK, extra });
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
        const payload = getDummyItem({ type: ItemType.LINK, extra });

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
        expectItem(item, payload);

        // a membership is created for this item
        const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = getDummyItem({
          type: ItemType.DOCUMENT,
          extra,
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = getDummyItem({
          type: ItemType.DOCUMENT,
          extra: { [ItemType.FOLDER]: { url: 'http://myurl.com' } } as any,
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if url of link is not an url', async () => {
        const payload1 = getDummyItem({
          type: ItemType.LINK,
          extra: { [ItemType.LINK]: { url: 'someurl' } } as any,
        });

        const response1 = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // cannot update a link
  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
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

      it('Bad Request for link', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.LINK,
            extra,
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              url: 'http://newurl.com',
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

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  // cannot update a link
  describe('PATCH many /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const { item } = await saveItemAndMembership({ member: actor });

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items?id=${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Fail to update', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.LINK,
            extra: {
              [ItemType.LINK]: {
                url: 'http://myurl.com',
              },
            } as any,
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              url: 'http://validurl.com',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?id=${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
