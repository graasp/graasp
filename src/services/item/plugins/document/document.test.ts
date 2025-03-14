import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import {
  DocumentItemExtraFlavor,
  DocumentItemFactory,
  HttpMethod,
  ItemType,
  PermissionLevel,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app.js';
import { MaybeUser } from '../../../../types.js';
import { saveMember } from '../../../member/test/fixtures/members.js';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items.js';

const testUtils = new ItemTestUtils();
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

const extra = {
  [ItemType.DOCUMENT]: {
    content: 'my text is here',
  },
};
describe('Document Item tests', () => {
  let app: FastifyInstance;
  let actor: MaybeUser;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = undefined;
    unmockAuthenticate();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      const payload = { name: 'name', type: ItemType.DOCUMENT, extra };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Create successfully', async () => {
        const payload = DocumentItemFactory({ extra });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check item exists in db
        const item = await testUtils.itemRepository.getOne(newItem.id);
        expectItem(item, payload);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = {
          name: 'name',
          type: ItemType.LINK,
          extra: { [ItemType.DOCUMENT]: { content: 'content' } },
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = {
          name: 'name',
          type: ItemType.DOCUMENT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extra: { [ItemType.FOLDER]: { content: 'content' } } as any,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if content of document is not defined', async () => {
        const payload1 = {
          name: 'name',
          type: ItemType.DOCUMENT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extra: { [ItemType.DOCUMENT]: {} } as any,
        };

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Update successfully', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'new value',
              // test that flavor can be updated
              flavor: DocumentItemExtraFlavor.Info,
            },
          },
          settings: {
            hasThumbnail: true,
            isCollapsible: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });
        // this test a bit how we deal with extra: it replaces existing keys
        expect(response.statusCode).toBe(StatusCodes.OK);

        expectItem(response.json(), {
          ...item,
          ...payload,
          extra: { ...item.extra, ...payload.extra },
          settings: { ...item.settings, ...payload.settings },
        });

        expect(response.json().settings).toMatchObject(payload.settings);
      });

      it('Bad Request if extra is invalid', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              content: 'new value',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });
    });
  });
});
