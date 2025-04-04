import { FastifyInstance } from 'fastify';

import build, { clearDatabase, unmockAuthenticate } from '../../../../../test/app';
import { db } from '../../../../drizzle/db';

describe('ZIP routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });

  // TODO
  // describe('export', () => {
  //   it('Do not include hidden children', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const mock = jest.spyOn(ZipFile.prototype, 'addEmptyDirectory');
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //     });
  //     const child1 = await testUtils.saveItem({
  //       actor,
  //       parentItem: item,
  //     });
  //     await testUtils.saveItem({
  //       actor,
  //       parentItem: item,
  //     });
  //     await new ItemVisibilityRepository().post(app.db, actor, child1, ItemVisibilityType.Hidden);

  //     const importExportService = new ImportExportService(
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const reply = {} as unknown as FastifyReply;
  //     await importExportService.exportRaw(db, actor, item);

  //     // called for parent and one child
  //     expect(mock).toHaveBeenCalledTimes(2);
  //   });
  // });

  // describe('fetchItemData', () => {
  //   it('fetch file data', async () => {
  //     jest.spyOn(nodeFetch, 'default').mockImplementation(
  //       async () =>
  //         ({
  //           body: new Blob([]),
  //         }) as unknown as nodeFetch.Response,
  //     );

  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.LOCAL_FILE,
  //         extra: {
  //           [ItemType.LOCAL_FILE]: {
  //             mimetype: 'image/png',
  //             name: 'name',
  //             path: 'path',
  //             size: 111,
  //             content: 'content',
  //           },
  //         },
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {
  //         getUrl: jest.fn(),
  //       } as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.png');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('image/png');
  //   });
  //   it('fetch app data', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.APP,
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.app');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('text/plain');
  //   });
  //   it('fetch link data', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.LINK,
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.url');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('text/plain');
  //   });
  //   it('fetch document data', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.DOCUMENT,
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.graasp');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('text/plain');
  //   });
  //   it('fetch document-html data', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.DOCUMENT,
  //         extra: {
  //           document: {
  //             content: 'hello',
  //             isRaw: true,
  //           },
  //         },
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {} as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.html');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('text/html');
  //   });
  //   it('fetch h5p data', async () => {
  //     jest.spyOn(nodeFetch, 'default').mockImplementation(
  //       async () =>
  //         ({
  //           body: new Blob([]),
  //         }) as unknown as nodeFetch.Response,
  //     );

  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.H5P,
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {
  //         getUrl: jest.fn(),
  //       } as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.h5p');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('application/octet-stream');
  //   });
  //   it('fetch etherpad data', async () => {
  //     jest.spyOn(nodeFetch, 'default').mockImplementation(
  //       async () =>
  //         ({
  //           body: new Blob([]),
  //         }) as unknown as nodeFetch.Response,
  //     );

  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //       item: {
  //         type: ItemType.ETHERPAD,
  //       },
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {
  //         getUrl: jest.fn(),
  //       } as unknown as H5PService,
  //       {
  //         getEtherpadContentFromItem: jest.fn(async () => 'mycontent'),
  //       } as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );
  //     const res = await importExportService.fetchItemData(app.db, actor, item);

  //     expect(res.name).toEqual(item.name + '.html');
  //     expect(res.stream).toBeDefined();
  //     expect(res.mimetype).toEqual('text/html');
  //   });
  //   it('throw for folder', async () => {
  //     actor = await saveMember();
  //     mockAuthenticate(actor);
  //     const { item } = await testUtils.saveItemAndMembership({
  //       member: actor,
  //     });
  //     const importExportService = new ImportExportService(
  //       app.db,
  //       {} as unknown as FileItemService,
  //       resolveDependency(ItemService),
  //       {
  //         getUrl: jest.fn(),
  //       } as unknown as H5PService,
  //       {} as unknown as EtherpadItemService,
  //       resolveDependency(BaseLogger),
  //     );

  //     await expect(() => importExportService.fetchItemData(app.db, actor, item)).rejects.toThrow();
  //   });
  // });
});
