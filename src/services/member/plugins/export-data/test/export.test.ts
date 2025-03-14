import fs from 'fs';
import path from 'path';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { TMP_FOLDER } from '../../../../../utils/config.js';
import { saveItemFavorites } from '../../../../item/plugins/itemBookmark/test/fixtures.js';
import { ItemTestUtils } from '../../../../item/test/fixtures/items.js';
import { saveMember } from '../../../test/fixtures/members.js';
import { ExportMemberDataService } from '../service.js';
import { DataArchiver, RequestDataExportService } from '../utils/export.utils.js';

const itemTestUtils = new ItemTestUtils();
const exportMemberDataService = new ExportMemberDataService({} as RequestDataExportService);

const storageFolder = path.join(TMP_FOLDER, 'export-data');
const archiveFileName = 'test-archiver';

const createOrReplaceFolder = (folder: string) => {
  if (fs.existsSync(folder)) {
    fs.rmdirSync(folder, { recursive: true });
  }
  fs.mkdirSync(folder, { recursive: true });
};

describe('Export member data tests', () => {
  let app: FastifyInstance;
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

    const dataToExport = await exportMemberDataService.getAllData(app.db, actor);
    const dataArchiver = new DataArchiver({ dataToExport, storageFolder, archiveFileName });
    const result = await dataArchiver.archiveData();

    // call on success callback
    expect(result).toBeTruthy();
    // create files for all data but only items are inserted so 1 file
    expect(writeFileSyncMock).toHaveBeenCalledTimes(numberOfDataInsert);
    const files = fs.readdirSync(storageFolder);

    // should have exactly to elements: the original folder and the ZIP
    expect(files.length).toEqual(2);
    // assume only 2 files exist in the folder
    const [folder, zip] = files;

    expect(zip.includes(archiveFileName)).toBeTruthy();
    expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(numberOfDataInsert);
  });
});
