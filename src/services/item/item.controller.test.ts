import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';

describe('Item controller', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  describe('GET /:id/descendants filters', () => {
    it('no filter', async () => {
      const {
        actor,
        items: [{ id: rootUUID }, { id: folderUUID }, { id: hiddenUUID }, { id: publicUUID }],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            children: [{}, { isHidden: true }, { isPublic: true }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const response = await app.inject({
        method: 'GET',
        url: `/items/${rootUUID}/descendants`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(3);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(folderUUID);
      expect(flat).toContain(hiddenUUID);
      expect(flat).toContain(publicUUID);
    });
    it('filter folders', async () => {
      const {
        actor,
        items: [{ id: rootUUID }, { id: folderUUID }],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            children: [
              { type: ItemType.FOLDER },
              { isHidden: true, type: ItemType.DOCUMENT },
              { isPublic: true, type: ItemType.DOCUMENT },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const response = await app.inject({
        method: 'GET',
        url: `/items/${rootUUID}/descendants?types=${ItemType.FOLDER}`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(1);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(folderUUID);
    });
    it('filter apps', async () => {
      const {
        actor,
        items: [{ id: rootUUID }, _, { id: hiddenUUID }, { id: publicUUID }],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            children: [
              {},
              { isHidden: true, type: ItemType.APP },
              { isPublic: true, type: ItemType.APP },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const response = await app.inject({
        method: 'GET',
        url: `/items/${rootUUID}/descendants?types=${ItemType.APP}`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(2);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(hiddenUUID);
      expect(flat).toContain(publicUUID);
    });
    it('filter hidden', async () => {
      const {
        actor,
        items: [{ id: rootUUID }, { id: folderUUID }, { id: hiddenUUID }, { id: publicUUID }],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            children: [{}, { isHidden: true }, { isPublic: true }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);
      const response = await app.inject({
        method: 'GET',
        url: `/items/${rootUUID}/descendants?showHidden=false`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(2);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(folderUUID);
      expect(flat).toContain(publicUUID);
      expect(flat).not.toContain(hiddenUUID);
    });
  });
});
