import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { AppItemFactory, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { Item } from '../../entities/Item';
import { ItemRepository } from '../../repository';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items';

jest.mock('node-fetch');

const testUtils = new ItemTestUtils();

const itemRepository = new ItemRepository();
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

const MOCK_URL = 'https://example.com';

describe('App Item tests', () => {
  let app: FastifyInstance;
  let actor: Member | undefined;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
    app.close();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = { name: 'name', url: MOCK_URL };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/apps',
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = { name: 'name', url: MOCK_URL, description: 'description' };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/apps',
          payload,
        });

        const expectedItem = {
          name: payload.name,
          type: ItemType.APP,
          extra: {
            [ItemType.APP]: {
              url: payload.url,
            },
          },
          description: payload.description,
        };

        // check response value
        const newItem = response.json();
        expect(response.statusCode).toBe(StatusCodes.OK);
        expectItem(newItem, expectedItem);

        // check item exists in db
        const item = await itemRepository.getOne(newItem.id);
        expectItem(item, expectedItem);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = {
          name: 'm',
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/apps',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if url of app is not an url', async () => {
        const payload1 = {
          url: 'someurl',
          name: 'myapp',
        };

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items/apps',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/apps/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Update successfully', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: AppItemFactory() as unknown as Item,
          member: actor,
        });
        const payload = {
          name: 'new name',
          settings: {
            isPinned: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/apps/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          settings: {
            ...item.settings,
            ...payload.settings,
          },
        });
      });
    });
  });
});
