import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { Context, ExportActionsFormatting } from '@graasp/sdk';

import build from '../../../../test/app.js';
import { db } from '../../../drizzle/db.js';
import { actionsTable, chatMessagesTable } from '../../../drizzle/schema.js';
import { MemberRaw } from '../../../drizzle/types.js';
import { TMP_FOLDER } from '../../../utils/config.js';
import { BaseAnalytics } from '../../item/plugins/action/base-analytics.js';
import { ItemTestUtils } from '../../item/test/fixtures/items.js';
import { saveMember } from '../../member/test/fixtures/members.js';
import { exportActionsInArchive } from './export.js';

const testUtils = new ItemTestUtils();

const setUpActions = async (app: FastifyInstance, member: MemberRaw) => {
  const itemId = v4();
  const views = Object.values(Context);
  const { item, itemMembership } = await testUtils.saveItemAndMembership({
    item: { id: itemId, name: 'item-name' },
    member,
  });
  const actions = await db
    .insert(actionsTable)
    .values(
      Array.from(Array(3)).map((_) => ({
        view: views[0],
        type: 'type',
        extra: JSON.stringify({ itemId: item.id }),
        itemId: item.id,
        accountId: member.id,
      })),
    )
    .returning();

  const chatMessages = await db
    .insert(chatMessagesTable)
    .values([
      {
        itemId: item.id,
        creatorId: member.id,
        body: 'some-text',
      },
      {
        itemId: item.id,
        creatorId: member.id,
        body: 'some-text-1',
      },
      {
        itemId: item.id,
        creatorId: member.id,
        body: 'some-text-2',
      },
    ])
    .returning();
  const baseAnalytics = new BaseAnalytics({
    actions,
    members: [member],
    itemMemberships: [itemMembership],
    item,
    descendants: [testUtils.createItem()],
    chatMessages,
    metadata: { numActionsRetrieved: 5, requestedSampleSize: 5 },
    apps: {},
  });
  return { baseAnalytics, actions, views };
};

const storageFolder = path.join(TMP_FOLDER, 'export-actions');
fs.mkdirSync(storageFolder, { recursive: true });

describe('exportActionsInArchive', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    app.close();
  });

  it('Create archive successfully', async () => {
    const member = await saveMember();
    const { baseAnalytics, views } = await setUpActions(app, member);

    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    const result = await exportActionsInArchive({
      baseAnalytics,
      storageFolder,
      views,
      format: ExportActionsFormatting.CSV,
    });

    // call on success callback
    expect(result).toBeTruthy();
    // create files for views, items, members and memberships, chat messages, apps only with data inside
    expect(writeFileSyncMock).toHaveBeenCalledTimes(6);
    const files = fs.readdirSync(storageFolder);
    expect(files.length).toBeTruthy();

    // assume only 2 files exist in the folder
    const [folder, zip] = files;
    expect(zip.includes(baseAnalytics.item.name)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(6);
  });
});
