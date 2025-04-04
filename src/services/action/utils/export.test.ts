import fs from 'fs';
import path from 'path';

import { FastifyInstance } from 'fastify';

import { ExportActionsFormatting } from '@graasp/sdk';

import build from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { TMP_FOLDER } from '../../../utils/config';
import { exportActionsInArchive } from './export';

const setUpActions = async () => {
  const {
    actions,
    chatMessages,
    items: [item, child],
    itemMemberships,
  } = await seedFromJson({
    items: [
      {
        memberships: [{ account: 'actor' }],
        actions: [{ account: 'actor' }, { account: 'actor' }, { account: 'actor' }],
        chatMessages: [
          {
            creator: 'actor',
            body: 'some-text',
          },
          {
            creator: 'actor',
            body: 'some-text-1',
          },
          {
            creator: 'actor',
            body: 'some-text-2',
          },
        ],
        children: [{}],
      },
    ],
  });

  // const itemId = v4();
  // const views = Object.values(Context);
  // const { item, itemMembership } = await testUtils.saveItemAndMembership({
  //   item: { id: itemId, name: 'item-name' },
  //   member,
  // });
  // const actions = await db
  //   .insert(actionsTable)
  //   .values(
  //     Array.from(Array(3)).map((_) => ({
  //       view: views[0],
  //       type: 'type',
  //       extra: { itemId: item.id },
  //       itemId: item.id,
  //       accountId: member.id,
  //     })),
  //   )
  //   .returning();

  // const baseAnalytics = new BaseAnalytics({
  //   actions,
  //   members: [],
  //   itemMemberships,
  //   item,
  //   descendants: [child],
  //   chatMessages,
  //   metadata: { numActionsRetrieved: 5, requestedSampleSize: 5 },
  //   apps: {},
  // });
  // TODO: fix views?
  return { baseAnalytics: {}, actions, views: [], item };
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
    const { item, views } = await setUpActions();

    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    const result = await exportActionsInArchive({
      baseAnalytics: {},
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
    expect(zip.includes(item.name)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(6);
  });
});
