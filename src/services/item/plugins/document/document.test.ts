import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items';

const testUtils = new ItemTestUtils();

describe('Document Item tests', () => {
  let app: FastifyInstance;
  let actor: Member | undefined;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
    app.close();
  });

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
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
        ({ app, actor } = await build());
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
              flavor: 'info' as const,
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
        expectItem(response.json(), {
          ...item,
          ...payload,
          extra: { ...item.extra, ...payload.extra },
          settings: { ...item.settings, ...payload.settings },
        });

        expect(response.json().settings).toMatchObject(payload.settings);

        expect(response.statusCode).toBe(StatusCodes.OK);
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

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
