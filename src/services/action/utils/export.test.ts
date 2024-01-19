import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { Context } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { TMP_FOLDER } from '../../../utils/config';
import { ChatMessage } from '../../chat/chatMessage';
import { ChatMessageRepository } from '../../chat/repository';
import { BaseAnalytics } from '../../item/plugins/action/base-analytics';
import { getDummyItem } from '../../item/test/fixtures/items';
import { saveItemAndMembership } from '../../itemMembership/test/fixtures/memberships';
import { Member } from '../../member/entities/member';
import { BOB, saveMember } from '../../member/test/fixtures/members';
import { Action } from '../entities/action';
import { ActionRepository } from '../repositories/action';
import { exportActionsInArchive } from './export';

// mock datasource
jest.mock('../../../plugins/datasource');

const createDummyAction = async ({ item, member, view }): Promise<Action> => {
  return ActionRepository.save({
    id: v4(),
    item,
    member,
    view,
    type: 'type',
    extra: { itemId: item?.id },
  });
};

const setUpActions = async (app, member: Member) => {
  const itemId = v4();
  const views = Object.values(Context);
  const { item, itemMembership } = await saveItemAndMembership({
    item: { id: itemId, name: 'item-name' },
    member,
  });
  const actions: Action[] = [
    await createDummyAction({ item, member, view: views[0] }),
    await createDummyAction({ item, member, view: views[0] }),
    await createDummyAction({ item, member, view: views[0] }),
  ];
  const chatMessages: ChatMessage[] = [];
  chatMessages.push(await ChatMessageRepository.save({ item, creator: member, body: 'some-text' }));
  chatMessages.push(
    await ChatMessageRepository.save({ item, creator: member, body: 'some-text-1' }),
  );
  chatMessages.push(
    await ChatMessageRepository.save({ item, creator: member, body: 'some-text-2' }),
  );
  const baseAnalytics = new BaseAnalytics({
    actions,
    members: [member],
    itemMemberships: [itemMembership],
    item,
    descendants: [getDummyItem()],
    chatMessages,
    metadata: { numActionsRetrieved: 5, requestedSampleSize: 5 },
    apps: {},
  });
  return { baseAnalytics, actions, views };
};

const storageFolder = path.join(TMP_FOLDER, 'export-actions');
fs.mkdirSync(storageFolder, { recursive: true });

describe('exportActionsInArchive', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  it('Create archive successfully', async () => {
    const member = await saveMember(BOB);
    const { baseAnalytics, views } = await setUpActions(app, member);

    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    const result = await exportActionsInArchive({
      baseAnalytics,
      storageFolder,
      views,
    });

    // call on success callback
    expect(result).toBeTruthy();
    // create files for all views, items, members and memberships, chat messages, apps
    expect(writeFileSyncMock).toHaveBeenCalledTimes(views.length + 6);
    const files = fs.readdirSync(storageFolder);
    expect(files.length).toBeTruthy();

    // assume only 2 files exist in the folder
    const [folder, zip] = files;
    expect(zip.includes(baseAnalytics.item.name)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(views.length + 6);
  });
});
