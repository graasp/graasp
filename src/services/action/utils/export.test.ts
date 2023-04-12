import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

import { buildItem } from 'graasp-test';

import { CLIENT_HOSTS, createDummyAction } from '../../test/constants';
import { VIEW_UNKNOWN_NAME } from '../constants/constants';
import { Action } from '../interfaces/action';
import { BaseAnalytics } from '../services/action/base-analytics';
import { CannotWriteFileError } from './errors';
import { exportActionsInArchive } from './export';

const itemId = v4();
const views = [...CLIENT_HOSTS.map(({ name }) => name), VIEW_UNKNOWN_NAME];
const actions: Action[] = [createDummyAction(), createDummyAction(), createDummyAction()];
const baseAnalytics = new BaseAnalytics({
  actions,
  members: [],
  itemMemberships: [],
  item: buildItem({ id: itemId, name: 'item-name' }),
  descendants: [buildItem()],
  metadata: { numActionsRetrieved: 5, requestedSampleSize: 5 },
});

const storageFolder = path.join(__dirname, 'tmp');
fs.mkdirSync(storageFolder, { recursive: true });

describe('exportActionsInArchive', () => {
  beforeEach(() => {
    fs.readdirSync(storageFolder).forEach((f) =>
      fs.rmSync(`${storageFolder}/${f}`, { recursive: true }),
    );
  });

  it('Create archive successfully', async () => {
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

  it('Throws if a file is not created', async () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error();
    });

    const onSuccess = jest.fn();
    await expect(async () => {
      await exportActionsInArchive({
        baseAnalytics,
        storageFolder,
        views,
      });
    }).rejects.toBeInstanceOf(CannotWriteFileError);

    // call on success callback
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
