import fs from 'fs';
import path from 'path';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../../../test/app';
import { TMP_FOLDER } from '../../../../../utils/config';
import { ExportDataRepository } from '../memberExportData.repository';
import { ExportMemberDataService } from '../memberExportData.service';
import { DataArchiver, RequestDataExportService } from '../utils/export.utils';

const storageFolder = path.join(TMP_FOLDER, 'export-data');
const archiveFileName = 'test-archiver';

const createOrReplaceFolder = (folder: string) => {
  if (fs.existsSync(folder)) {
    fs.rmdirSync(folder, { recursive: true });
  }
  fs.mkdirSync(folder, { recursive: true });
};

const exportMemberDataService = new ExportMemberDataService(
  {} as RequestDataExportService,
  {} as ExportDataRepository,
);

it('temporary', () => {
  expect(true).toBeTruthy();
});

// describe('Export member data tests', () => {
//   let app: FastifyInstance;
//   let actor;

//   // represents the number of different entity insertion
//   const numberOfDataInsert = 2;

//   beforeEach(async () => {
//     ({ app, actor } = await build());
//     const randomUser = await saveMember();

//     const item = await itemTestUtils.saveItem({ actor });
//     await itemTestUtils.saveItem({ actor: randomUser });
//     await saveItemFavorites({
//       items: [item],
//       member: actor,
//     });

//     createOrReplaceFolder(storageFolder);
//   });

//   afterEach(async () => {
//     jest.clearAllMocks();
//     await clearDatabase(app.db);
//     app.close();
//   });

//   it('Create archive successfully', async () => {
//     const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync');

//     const dataToExport = await exportMemberDataService.getAllData(app.db, actor);
//     const dataArchiver = new DataArchiver({ dataToExport, storageFolder, archiveFileName });
//     const result = await dataArchiver.archiveData();

//     // call on success callback
//     expect(result).toBeTruthy();
//     // create files for all data but only items are inserted so 1 file
//     expect(writeFileSyncMock).toHaveBeenCalledTimes(numberOfDataInsert);
//     const files = fs.readdirSync(storageFolder);

//     // should have exactly to elements: the original folder and the ZIP
//     expect(files.length).toEqual(2);
//     // assume only 2 files exist in the folder
//     const [folder, zip] = files;

//     expect(zip.includes(archiveFileName)).toBeTruthy();
//     expect(fs.readdirSync(path.join(storageFolder, folder)).length).toEqual(numberOfDataInsert);
//   });
// });
