import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  AppItemFactory,
  FolderItemFactory,
  ItemTagType,
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
    let uuids;
    beforeEach(async () => {
      // uuids[0] is the root
      // uuids[1] is folder
      // uuids[2] is hidden
      // uuids[3] is public
      uuids = [uuid(), uuid(), uuid(), uuid()];
      await seed({
        folders: {
          factory: FolderItemFactory,
          constructor: Item,
          entities: [
            { id: uuids[0], creator: actor?.id },
            { id: uuids[1], creator: actor?.id, path: buildPathFromIds(uuids[0], uuids[1]) },
          ],
        },
        subItems: {
          factory: AppItemFactory,
          constructor: Item,
          entities: [
            {
              id: uuids[2],
              path: buildPathFromIds(uuids[0], uuids[2]),
              creator: actor?.id,
            },
            {
              id: uuids[3],
              path: buildPathFromIds(uuids[0], uuids[3]),
              creator: actor?.id,
            },
          ],
        },
        itemMembership: {
          constructor: ItemMembership,
          entities: [
            {
              item: buildPathFromIds(uuids[0]),
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
              item: buildPathFromIds(uuids[0], uuids[2]),
            },
            {
              type: ItemTagType.Public,
              item: buildPathFromIds(uuids[0], uuids[3]),
            },
          ],
        },
      });
    });
    it('no filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/items/${uuids[0]}/descendants`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(3);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(uuids[1]);
      expect(flat).toContain(uuids[2]);
      expect(flat).toContain(uuids[3]);
    });
    it('filter folders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/items/${uuids[0]}/descendants?types=folder`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(1);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(uuids[1]);
    });
    it('filter hidden', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/items/${uuids[0]}/descendants?showHidden=false`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const json = response.json();
      expect(json).toHaveLength(2);
      const flat = json.flatMap((i) => i.id);
      expect(flat).toContain(uuids[1]);
      expect(flat).toContain(uuids[3]);
    });
  });
});
