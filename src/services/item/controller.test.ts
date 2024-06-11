import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  AppItemFactory,
  FolderItemFactory,
  ItemTagType,
  ItemType,
  PermissionLevel,
  buildPathFromIds,
} from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import seed from '../../../test/mock';
import '../../plugins/datasource';
import { ItemMembership } from '../itemMembership/entities/ItemMembership';
import { Actor } from '../member/entities/member';
import { Item } from './entities/Item';
import { ItemTag } from './plugins/itemTag/ItemTag';

jest.mock('../../plugins/datasource');

describe('Item controller', () => {
  let app: FastifyInstance;
  let actor: Actor;
  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
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
              member: actor?.id,
              permission: PermissionLevel.Admin,
            },
          ],
        },
        itemTags: {
          constructor: ItemTag,
          entities: [
            {
              type: ItemTagType.Hidden,
              item: buildPathFromIds(rootUUID, hiddenUUID),
            },
            {
              type: ItemTagType.Public,
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
