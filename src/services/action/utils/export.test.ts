import fs from 'fs';
import path from 'path';

import type { FastifyInstance } from 'fastify';

import { Context, ExportActionsFormatting } from '@graasp/sdk';

import build from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { TMP_FOLDER } from '../../../utils/config';
import { exportActionsInArchive } from './export';

const setUpActions = async () => {
  const {
    actions,
    chatMessages,
    items: [item],
    itemMemberships,
    members,
    appActions,
    appData,
    appSettings,
  } = await seedFromJson({
    members: [{}],
    items: [
      {
        memberships: [{ account: 'actor' }],
        actions: [
          { account: 'actor', view: Context.Builder },
          { account: 'actor', view: Context.Builder },
          { account: 'actor', view: Context.Builder },
        ],
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
        appData: [{ account: 'actor', creator: 'actor' }],
      },
    ],
  });

  return {
    baseAnalytics: {},
    actions,
    views: Object.values(Context),
    item,
    members,
    chatMessages,
    itemMemberships,
    appActions,
    appData,
    appSettings,
  };
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
    const { item, views, members, itemMemberships, chatMessages, appData, actions } =
      await setUpActions();

    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    const result = await exportActionsInArchive({
      baseAnalytics: {
        actions,
        item,
        descendants: [],
        members,
        itemMemberships,
        chatMessages,
        apps: [{ actions: [], data: appData, settings: [] }],
      },
      storageFolder,
      views,
      format: ExportActionsFormatting.CSV,
    });

    // call on success callback
    expect(result).toBeTruthy();
    // create files for app actions in one view, items, descendants, members and memberships, chat messages, apps only with data inside
    expect(writeFileSyncMock).toHaveBeenCalledTimes(6);
    const files = fs.readdirSync(storageFolder);
    expect(files.length).toBeTruthy();

    // zip file exists for item
    expect(files.some((f) => f.includes(item.id) && f.endsWith('.zip'))).toBeTruthy();
  });
});
