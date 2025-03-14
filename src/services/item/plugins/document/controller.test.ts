import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { DocumentItemExtraFlavor, HttpMethod, ItemType, MemberFactory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app.js';
import { MaybeUser } from '../../../../types.js';
import { saveMember } from '../../../member/test/fixtures/members.js';
import { ItemTestUtils } from '../../test/fixtures/items.js';

const testUtils = new ItemTestUtils();
const rawGuestRepository = AppDataSource.getRepository(Guest);

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

  describe('POST /items/documents', () => {
    it('Throws if signed out', async () => {
      const payload = { name: 'name', content: 'content' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Throws if actor is guest', async () => {
      const payload = { name: 'name', content: 'content' };
      const actor = await rawGuestRepository.save({ name: 'guest' });
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const payload = { name: 'name', content: 'content' };
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if content is empty', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const payload = { name: 'name', content: '' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if isRaw is invalid', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const payload = { name: 'name', content: 'content', isRaw: 'value' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if flavor is invalid', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const payload = { name: 'name', content: 'content', flavor: 'value' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/documents',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Create successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/documents',
          payload: { name: 'name', content: 'content' },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('PATCH /items/documents/:id', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Throws if actor is guest', async () => {
      const actor = await rawGuestRepository.save({ name: 'guest' });
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if content is empty', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const payload = { name: 'name', content: '' };
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if isRaw is invalid', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const payload = { name: 'name', content: 'content', isRaw: 'value' };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Throws if flavor is invalid', async () => {
      const actor = await saveMember(MemberFactory());
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const payload = { name: 'name', content: 'content', flavor: 'value' };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/documents/${item.id}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
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
          content: 'new value',
          // test that flavor can be updated
          flavor: DocumentItemExtraFlavor.Info,

          settings: {
            hasThumbnail: true,
            isCollapsible: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/documents/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
