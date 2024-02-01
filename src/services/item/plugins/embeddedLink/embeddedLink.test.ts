import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';

import { EmbeddedLinkItemExtra, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../member/test/fixtures/members';
import { ItemRepository } from '../../repository';
import { expectItem, getDummyItem } from '../../test/fixtures/items';

jest.mock('node-fetch');

// mock datasource
jest.mock('../../../../plugins/datasource');

const iframelyMeta = {
  title: 'title',
  description: 'description',
};

const iframelyResult = {
  meta: iframelyMeta,
  html: 'html',
  icons: [],
  thumbnails: [],
};
const extra = {
  [ItemType.LINK]: {
    html: 'html',
    icons: [],
    thumbnails: [],
    url: 'http://myurl.com',
  },
} as EmbeddedLinkItemExtra;

// TODO: test iframely

describe('Link Item tests', () => {
  let app;
  let actor;

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = { name: 'link', type: ItemType.LINK, extra };
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
        const payload = { type: ItemType.LINK, extra, name: 'mylink' };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        const expectedItem = getDummyItem({
          name: iframelyMeta.title,
          type: ItemType.LINK,
          extra,
          description: iframelyMeta.description,
        });

        // check response value
        const newItem = response.json();
        expectItem(newItem, expectedItem);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check item exists in db
        const item = await ItemRepository.get(newItem.id);
        expectItem(item, expectedItem);

        // a membership is created for this item
        const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = {
          type: ItemType.DOCUMENT,
          extra,
          name: 'mylink',
        };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = {
          type: ItemType.DOCUMENT,
          extra: { [ItemType.FOLDER]: { url: 'http://myurl.com' } },
          name: 'mylink',
        };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if url of link is not an url', async () => {
        const payload1 = {
          type: ItemType.LINK,
          extra: { [ItemType.LINK]: { url: 'someurl' } },
          name: 'mylink',
        };

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
          item: {
            name: 'link item',
            type: ItemType.LINK,
            extra,
          },
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
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

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
          item: {
            type: ItemType.LINK,
            extra: {
              [ItemType.LINK]: {
                url: 'http://myurl.com',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            name: 'mylink',
          },
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
