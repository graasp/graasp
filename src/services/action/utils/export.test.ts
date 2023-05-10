import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import build, { clearDatabase } from '../../../../test/app';
import { CLIENT_HOSTS, TMP_FOLDER } from '../../../utils/config';
import { BaseAnalytics } from '../../item/plugins/action/base-analytics';
import { getDummyItem } from '../../item/test/fixtures/items';
import { saveItemAndMembership } from '../../itemMembership/test/fixtures/memberships';
import { Member } from '../../member/entities/member';
import { BOB, saveMember } from '../../member/test/fixtures/members';
import { VIEW_UNKNOWN_NAME } from '../constants/constants';
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
  const views = [...CLIENT_HOSTS.map(({ name }) => name), VIEW_UNKNOWN_NAME];
  const { item, itemMembership } = await saveItemAndMembership({
    item: { id: itemId, name: 'item-name' },
    member,
  });
  const actions: Action[] = [
    await createDummyAction({ item, member, view: views[0] }),
    await createDummyAction({ item, member, view: views[0] }),
    await createDummyAction({ item, member, view: views[0] }),
  ];
  const baseAnalytics = new BaseAnalytics({
    actions,
    members: [member],
    itemMemberships: [itemMembership],
    item,
    descendants: [getDummyItem()],
    metadata: { numActionsRetrieved: 5, requestedSampleSize: 5 },
  });
  return { baseAnalytics, actions, views };
};

const storageFolder = path.join(TMP_FOLDER, 'tmp');
fs.mkdirSync(storageFolder, { recursive: true });

describe('exportActionsInArchive', () => {
  let app;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  it.only('Create archive successfully', async () => {
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
    // create files for all views, items, members and memberships
    expect(writeFileSyncMock).toHaveBeenCalledTimes(views.length + 4);
    const files = fs.readdirSync(storageFolder);
    expect(files.length).toBeTruthy();

    const [folder, zip] = files;
    expect(zip.includes(baseAnalytics.item.name)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(views.length + 4);
  });

  // it('Throws if a file is not created', async () => {
  //   jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
  //     throw new Error();
  //   });

  //   const onSuccess = jest.fn();
  //   await expect(async () => {
  //     await exportActionsInArchive({
  //       baseAnalytics,
  //       storageFolder,
  //       views,
  //     });
  //   }).rejects.toBeInstanceOf(CannotWriteFileError);

  //   // call on success callback
  //   expect(onSuccess).not.toHaveBeenCalled();
  // });
});
