import fs from 'fs';
import path from 'path';

import build, { clearDatabase } from '../../../../../../test/app';
import { TMP_FOLDER } from '../../../../../utils/config';
import { buildRepositories } from '../../../../../utils/repositories';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';
import { saveMember } from '../../../test/fixtures/members';
import { DataMemberService } from '../service';
import { DataArchiver } from '../utils/export.utils';
import { saveItemFavorites } from './fixtures';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const itemTestUtils = new ItemTestUtils();
const dataMemberService = new DataMemberService();

const storageFolder = path.join(TMP_FOLDER, 'export-data');
const archiveFileName = 'test-archiver';

const createOrReplaceFolder = (folder: string) => {
  if (fs.existsSync(folder)) {
    fs.rmdirSync(folder, { recursive: true });
  }
  fs.mkdirSync(folder, { recursive: true });
};

describe('archives data in ZIP', () => {
  let app;
  let actor;

  // represents the number of different entity insertion
  const numberOfDataInsert = 2;

  beforeEach(async () => {
    ({ app, actor } = await build());
    const randomUser = await saveMember();

    const item = await itemTestUtils.saveItem({ actor });
    await itemTestUtils.saveItem({ actor: randomUser });
    await saveItemFavorites({
      items: [item],
      member: actor,
    });

    createOrReplaceFolder(storageFolder);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  it('Create archive successfully', async () => {
    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

    const dataToExport = await dataMemberService.getAllData(actor, buildRepositories());
    const dataArchiver = new DataArchiver({ dataToExport, storageFolder, archiveFileName });
    const result = await dataArchiver.archiveData();

    // call on success callback
    expect(result).toBeTruthy();
    // create files for all data but only items are inserted so 1 file
    expect(writeFileSyncMock).toHaveBeenCalledTimes(numberOfDataInsert);
    const files = fs.readdirSync(storageFolder);

    // should have exactly to elements: the original folder and the ZIP
    expect(files.length).toEqual(1);
    // assume only 2 files exist in the folder
    const [folder, zip] = files;

    expect(zip.includes(archiveFileName)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(numberOfDataInsert);
  });
});
