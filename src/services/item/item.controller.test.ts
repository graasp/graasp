import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  AppItemFactory,
  FolderItemFactory,
  ItemType,
  ItemVisibilityType,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app.js';
import seed from '../../../test/mocks/seed.js';
import { MaybeUser } from '../../types.js';

describe('Item controller', () => {
  let app: FastifyInstance;
  let actor: MaybeUser;
  beforeAll(async () => {
    ({ app, actor } = await build());
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /:id/descendants filters', () => {
    let rootUUID;
    let folderUUID;
    let hiddenUUID;
    let publicUUID;
    beforeEach(async () => {
      rootUUID = uuid();
      folderUUID = uuid();
      hiddenUUID = uuid();
      publicUUID = uuid();
      await seed({
        folders: {
          factory: FolderItemFactory,
          constructor: Item,
          entities: [
            { id: rootUUID, creator: actor?.id },
            { id: folderUUID, creator: actor?.id, path: buildPathFromIds(rootUUID, folderUUID) },
          ],
        },
        subItems: {
          factory: AppItemFactory,
          constructor: Item,
          entities: [
            {
              id: hiddenUUID,
              path: buildPathFromIds(rootUUID, hiddenUUID),
              creator: actor?.id,
            },
            {
              id: publicUUID,
              path: buildPathFromIds(rootUUID, publicUUID),
              creator: actor?.id,
            },
          ],
        },
        itemMembership: {
          constructor: ItemMembership,
          entities: [
            {
              item: buildPathFromIds(rootUUID),
              account: actor?.id,
              permission: PermissionLevel.Admin,
            },
          ],
        },
        itemVisibilities: {
          constructor: ItemVisibility,
          entities: [
            {
              type: ItemVisibilityType.Hidden,
              item: buildPathFromIds(rootUUID, hiddenUUID),
            },
            {
              type: ItemVisibilityType.Public,
              item: buildPathFromIds(rootUUID, publicUUID),
            },
          ],
        },
      });
    });
    it('no filter', async () => {
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
    });
  });
});
