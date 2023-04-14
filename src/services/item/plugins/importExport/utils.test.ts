// import archiver from 'archiver';
// import fs, { createReadStream } from 'fs';
// import { readFile } from 'fs/promises';
// import path from 'path';

// import { FastifyLoggerInstance } from 'fastify';

// import { Item, ItemType } from '@graasp/sdk';

// const DEFAULT_FILE_SERVICE_TYPE = 'file';
// const DEFAULT_PARENT_ID = 'parentId';
// const DEFAULT_LOGGER = {} as unknown as FastifyLoggerInstance;

// const buildMock = (taskManager: FileTaskManager, mockItem) =>
//   jest.spyOn(taskManager, 'createDownloadFileTask').mockImplementation((member, { itemId }) => {
//     if (mockItem.id === itemId)
//       // set task result to a valid readstream, content doesn't matter here
//       return new Task(createReadStream(path.resolve(__dirname, '../../test', FIXTURE_IMAGE_PATH)));
//     else return new Task(null);
//   });

// describe('Utils', () => {
//   describe('generateItemFromFilename', () => {
//     it('Hidden file', async () => {
//       const uploadFileMock = jest.fn();

//       const item = await generateItemFromFilename({
//         filename: '.hiddenfile',
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: uploadFileMock,
//       });

//       expect(item).toBeFalsy();
//     });
//     it('Folder', async () => {
//       const item = await generateItemFromFilename({
//         filename: FOLDER_NAME,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: jest.fn(),
//       });

//       expect(item).toEqual({ name: FOLDER_NAME, type: ItemType.FOLDER });
//     });
//     it('Image', async () => {
//       const imageFilename = `${IMAGE_NAME}.png`;
//       const uploadPath = 'uploadFilePath';
//       const uploadFileMock = jest.fn().mockReturnValue(uploadPath);

//       const item = await generateItemFromFilename({
//         filename: imageFilename,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: uploadFileMock,
//       });

//       const { size } = fs.lstatSync(path.resolve(__dirname, '../../test', FOLDER_PATH, 'img.png'));

//       expect(item).toEqual({
//         name: imageFilename,
//         type: DEFAULT_FILE_SERVICE_TYPE,
//         extra: {
//           [DEFAULT_FILE_SERVICE_TYPE]: {
//             name: imageFilename,
//             path: uploadPath,
//             size,
//             mimetype: 'image/png',
//           },
//         },
//         settings: buildSettings(true),
//       });
//       expect(uploadFileMock).toHaveBeenCalledTimes(1);
//     });
//     it('Image without extension', async () => {
//       const imageFilename = `${IMAGE_NAME_WITHOUT_EXTENSION}`;
//       const uploadPath = 'uploadFilePath';
//       const uploadFileMock = jest.fn().mockReturnValue(uploadPath);

//       const item = await generateItemFromFilename({
//         filename: imageFilename,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: uploadFileMock,
//       });

//       const { size } = fs.lstatSync(
//         path.resolve(__dirname, '../../test', FOLDER_PATH, 'img_no_extension'),
//       );

//       expect(item).toEqual({
//         name: imageFilename,
//         type: DEFAULT_FILE_SERVICE_TYPE,
//         extra: {
//           [DEFAULT_FILE_SERVICE_TYPE]: {
//             name: imageFilename,
//             path: uploadPath,
//             size,
//             mimetype: 'image/png',
//           },
//         },
//         settings: buildSettings(true),
//       });
//       expect(uploadFileMock).toHaveBeenCalledTimes(1);
//     });
//     it('Graasp Document', async () => {
//       const documentFilename = `${DOCUMENT_NAME}.graasp`;

//       const item = await generateItemFromFilename({
//         filename: documentFilename,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: jest.fn(),
//       });
//       const filepath = path.resolve(__dirname, '../../test', FOLDER_PATH, documentFilename);
//       const content = await readFile(filepath, {
//         encoding: 'utf8',
//         flag: 'r',
//       });

//       expect(item).toEqual({
//         name: DOCUMENT_NAME,
//         type: ItemType.DOCUMENT,
//         extra: {
//           [ItemType.DOCUMENT]: {
//             content,
//           },
//         },
//       });
//     });
//     it('Link', async () => {
//       const filename = `${LINK_NAME}.url`;

//       const item = await generateItemFromFilename({
//         filename,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: jest.fn(),
//       });

//       expect(item).toEqual({
//         name: LINK_NAME,
//         type: ItemType.LINK,
//         extra: {
//           [ItemType.LINK]: {
//             url: 'https://graasp.org',
//           },
//         },
//       });
//     });
//     it('App', async () => {
//       const filename = `${APP_NAME}.url`;

//       const item = await generateItemFromFilename({
//         filename,
//         folderPath: path.resolve(__dirname, '../../test', FOLDER_PATH),
//         log: DEFAULT_LOGGER,
//         fileItemType: DEFAULT_FILE_SERVICE_TYPE,
//         uploadFile: jest.fn(),
//       });

//       expect(item).toEqual({
//         name: APP_NAME,
//         type: ItemType.APP,
//         extra: {
//           [ItemType.APP]: {
//             url: 'https://graasp.org',
//           },
//         },
//       });
//     });
//   });

//   describe('handleItemDescription', () => {
//     it('Parent description', async () => {
//       const updateParentDescriptionMock = jest.fn();

//       const folderName = DEFAULT_FOLDER_NAME;
//       const filename = `${folderName}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name: folderName, type: ItemType.FOLDER }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: updateParentDescriptionMock,
//       });

//       expect(updateParentDescriptionMock).toHaveBeenCalledTimes(1);
//     });
//     it(FOLDER_NAME, async () => {
//       const name = FOLDER_NAME;
//       const filename = `${name}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name, type: ItemType.FOLDER }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName: DEFAULT_FOLDER_NAME,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: jest.fn(),
//       });

//       // description content mocked with file name
//       // contain instead of equal because of break lines
//       expect(items[0].description).toContain(name);
//     });
//     it('Image', async () => {
//       const name = `${IMAGE_NAME}.png`;
//       const filename = `${name}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name, type: DEFAULT_FILE_SERVICE_TYPE }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName: DEFAULT_FOLDER_NAME,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: jest.fn(),
//       });

//       // description content mocked with file name
//       // contain instead of equal because of break lines
//       expect(items[0].description).toContain(name);
//     });
//     it('Graasp Document', async () => {
//       const name = 'document.graasp';
//       const filename = `${name}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name: 'document', type: ItemType.DOCUMENT }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName: DEFAULT_FOLDER_NAME,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: jest.fn(),
//       });

//       // description content mocked with file name
//       // contain instead of equal because of break lines
//       expect(items[0].description).toContain(name);
//     });
//     it('Link', async () => {
//       const name = `${LINK_NAME}.url`;
//       const filename = `${name}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name: LINK_NAME, type: ItemType.LINK }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName: DEFAULT_FOLDER_NAME,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: jest.fn(),
//       });

//       // description content mocked with file name
//       // contain instead of equal because of break lines
//       expect(items[0].description).toContain(name);
//     });
//     it('App', async () => {
//       const name = `${APP_NAME}.url`;
//       const filename = `${name}${DESCRIPTION_EXTENSION}`;
//       const items: Partial<Item>[] = [{ name: APP_NAME, type: ItemType.APP }];

//       await handleItemDescription({
//         filename,
//         filepath: path.resolve(__dirname, '../../test', FOLDER_PATH, filename),
//         folderName: DEFAULT_FOLDER_NAME,
//         parentId: DEFAULT_PARENT_ID,
//         items,
//         updateParentDescription: jest.fn(),
//       });

//       // description content mocked with file name
//       // contain instead of equal because of break lines
//       expect(items[0].description).toContain(name);
//     });
//   });

//   describe('addItemToZip', () => {
//     const archiverMock = archiver.create('zip');
//     const runner = new TaskRunner();
//     const h5pTaskManager = {
//       createDownloadH5PFileTask: jest.fn(),
//     };

//     beforeEach(() => {
//       jest.clearAllMocks();
//       jest.spyOn(runner, 'runSingle').mockImplementation(async (task) => task.result);
//     });

//     it(ItemType.LOCAL_FILE, async () => {
//       const localFileTaskManager = new FileTaskManager(
//         DEFAULT_OPTIONS.fileConfigurations,
//         ItemType.LOCAL_FILE,
//       );
//       buildMock(localFileTaskManager, ITEM_LOCAL);
//       jest.spyOn(archiverMock, 'append').mockImplementation((stream, entry) => {
//         expect(entry?.name).toEqual(ITEM_LOCAL.name);
//         return archiverMock;
//       });

//       await addItemToZip({
//         item: ITEM_LOCAL,
//         archiveRootPath: '',
//         archive: archiverMock,
//         fileTaskManagers: { file: localFileTaskManager, h5p: h5pTaskManager },
//         fileItemType: ItemType.LOCAL_FILE,
//         fileStorage: '',
//         getChildrenFromItem: jest.fn(),
//         downloadFile: jest.fn(),
//       });
//     });

//     it(ItemType.S3_FILE, async () => {
//       const S3FileTaskManager = new FileTaskManager(
//         DEFAULT_OPTIONS.fileConfigurations,
//         ItemType.S3_FILE,
//       );
//       buildMock(S3FileTaskManager, ITEM_S3);
//       jest.spyOn(archiverMock, 'append').mockImplementation((stream, entry) => {
//         expect(entry?.name).toEqual(ITEM_S3.name);
//         return archiverMock;
//       });

//       await addItemToZip({
//         item: ITEM_S3,
//         archiveRootPath: '',
//         archive: archiverMock,
//         fileTaskManagers: { file: S3FileTaskManager, h5p: h5pTaskManager },
//         fileItemType: ItemType.S3_FILE,
//         fileStorage: '',
//         getChildrenFromItem: jest.fn(),
//         downloadFile: jest.fn(),
//       });
//     });

//     it(ItemType.H5P, async () => {
//       const S3FileTaskManager = new FileTaskManager(
//         DEFAULT_OPTIONS.fileConfigurations,
//         ItemType.S3_FILE,
//       );
//       buildMock(S3FileTaskManager, ITEM_H5P);
//       jest.spyOn(archiverMock, 'append').mockImplementation((stream, entry) => {
//         expect(entry?.name).toEqual(ITEM_H5P.name);
//         return archiverMock;
//       });

//       await addItemToZip({
//         item: ITEM_H5P,
//         archiveRootPath: '',
//         archive: archiverMock,
//         fileTaskManagers: { file: S3FileTaskManager, h5p: h5pTaskManager },
//         fileItemType: ItemType.S3_FILE,
//         fileStorage: '',
//         getChildrenFromItem: jest.fn(),
//         downloadFile: jest.fn(),
//       });
//     });
//   });
// });
