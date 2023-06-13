import { MeiliSearch, TaskStatus as SearchTaskStatus } from 'meilisearch';
import searchPlugin from '../src/services/items/search';
import {parseItem} from '../src/services/items/search';
import { ItemTagService } from 'graasp-item-tags';
import { Actor, buildDocumentExtra, buildFileExtra, DocumentItemExtraProperties, EtherpadItemExtra, FileItemProperties, ItemType } from '@graasp/sdk';
import { DatabaseTransactionConnection as TrxHandler } from 'slonik';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, unlinkSync } from 'fs';
import {
  DiscriminatedItem,
  PostHookHandlerType,
  PreHookHandlerType,
  Item,
} from '@graasp/sdk';
import fastify, { FastifyLoggerInstance } from 'fastify';
import { PadOptionalRev,PadText } from '@graasp/etherpad-api';
import { getDummyItem } from './fixtures/items';
import { FastifyInstance } from 'fastify';
import {
  MEILISEARCH_API_MASTERKEY,
  FILE_STORAGE_ROOT_PATH,
} from '../src/util/config';
import path from 'path';
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');
jest.mock('@graasp/sdk', () => {
  const actualModule = jest.requireActual('@graasp/sdk');
  return {
    ...actualModule,
    getParentFromPath: jest.fn((path) => {
      if(path == 'defined')
        return '0000';
      else
        return undefined;
    }),
  };
});
const meilisearchClient = new MeiliSearch({
  host: 'http://meilisearch:8080',
  apiKey: MEILISEARCH_API_MASTERKEY,
});
const itemIndex = 'itemjest';

describe('Meilisearch tests', () => {
  beforeEach( async () => {
    jest.clearAllMocks();
    await meilisearchClient.deleteIndexIfExists(itemIndex);
  });

  describe('Meilisearch configuration', () => {
    let app: FastifyInstance;
    let log: FastifyLoggerInstance;
    let publishHandler: PostHookHandlerType<any>;
    let updateHandler: PostHookHandlerType<any>;
    let moveHandler: PostHookHandlerType<any>;
    let deleteHandler: PreHookHandlerType<any>;
    let actor:Actor;
    let etherPadContent:string;
    let itemTagService:ItemTagService;
    afterEach(async() => {
      const taskDeletion = await(await meilisearchClient.getIndex(itemIndex)).deleteAllDocuments();
      const taskResult = meilisearchClient.waitForTask(taskDeletion.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
    });
    beforeEach(async () => {
      app = fastify();
      log = app.log;
      actor = {id:'mockActor',};
      app.decorate('taskRunner', {
        setTaskPostHookHandler: <T>(taskName: string, handler: PostHookHandlerType<T>) => {
          switch (taskName) {
            // case 'publish': publishHandler = <PostHookHandlerType<DiscriminatedItem>>(handler);
            case 'publish': publishHandler = handler;
            case 'update': updateHandler = handler;
            case 'move': moveHandler = handler;
          }
        },
        setTaskPreHookHandler: <T>(taskName: string, handler: PreHookHandlerType<T>) => {
          switch (taskName) {
            // case 'publish': publishHandler = <PostHookHandlerType<DiscriminatedItem>>(handler);
            case 'delete': deleteHandler = handler;
          }
        },
      });
      app.decorate('publish', {
        taskManager:{
          getPublishItemTaskName: () => 'publish',
        },
      });

      app.decorate('etherpad', {
        api:{getText: function x():void{console.log('help');}},
      });
      
      app.decorate('items', {
        dbService: {
          getDescendants: function x():void{console.log('help');},
        },
        taskManager:{
          getUpdateTaskName:() => 'update',
          getDeleteTaskName:() => 'delete',
          getMoveTaskName:() => 'move',
        }
      });
      
      if (app.etherpad === undefined)
        throw new Error('Error etherpad is undefined');
      etherPadContent = 'this is a sample text for etherpad';
      jest.spyOn(app.etherpad.api, 'getText').mockImplementation(async (qs: PadOptionalRev, throwOnEtherpadError?: boolean):Promise<Pick<PadText, 'text'> | null>=> { const sampleTextEtherpad:PadText = {padID:'0001',text:etherPadContent};
     return sampleTextEtherpad; 
    });
      itemTagService = new ItemTagService();
      await app.register(searchPlugin,{ tags: { service: itemTagService }, indexName:itemIndex});
    
    });

    it('Publish folder', async () => {
      const extraInfoDoc : DocumentItemExtraProperties = {content:''};
      const subItemOne = getDummyItem({type:ItemType.DOCUMENT,extra:buildDocumentExtra(extraInfoDoc)});
      const subItemTwo = getDummyItem({type:ItemType.DOCUMENT,extra:buildDocumentExtra(extraInfoDoc)});
      jest.spyOn(app.items.dbService, 'getDescendants').mockImplementationOnce( async(_item:Item, _handler:TrxHandler):Promise<Item[]>=> {
          return [subItemOne,subItemTwo];
      });

      const folder = getDummyItem();
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expectedFolder = await parseItem(<DiscriminatedItem>(folder), etherpad);
      const expectedsubItemOne= await parseItem(<DiscriminatedItem>(subItemOne), etherpad);
      const expectedsubItemTwo = await parseItem(<DiscriminatedItem>(subItemTwo), etherpad);
      await publishHandler(folder,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for
      let indexDocument = await meilisearchClient.index(itemIndex).getDocument(folder.id);
      expect(indexDocument).toEqual(expectedFolder);
      indexDocument = await meilisearchClient.index(itemIndex).getDocument(subItemOne.id);
      expect(indexDocument).toEqual(expectedsubItemOne);
      indexDocument = await meilisearchClient.index(itemIndex).getDocument(subItemTwo.id);
      expect(indexDocument).toEqual(expectedsubItemTwo);
    });

    it('Publish folder with sub folders', async () => {
      const extraInfoDoc : DocumentItemExtraProperties = {content:'',};
      const subFolderOne = getDummyItem();
      const subFolderTwo = getDummyItem();
      const itemInSubFolder = getDummyItem({type:ItemType.DOCUMENT,extra:buildDocumentExtra(extraInfoDoc)});
      jest.spyOn(app.items.dbService, 'getDescendants')
      .mockImplementationOnce(async (_item, _handler) => {
        return [subFolderOne, subFolderTwo,itemInSubFolder];
      });

      const folder = getDummyItem();
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expectedFolder = await parseItem(<DiscriminatedItem>(folder), etherpad);
      const expectedsubItemOne= await parseItem(<DiscriminatedItem>(subFolderOne), etherpad);
      const expectedsubItemTwo = await parseItem(<DiscriminatedItem>(subFolderTwo), etherpad);
      const expectedsubItemThree = await parseItem(<DiscriminatedItem>(itemInSubFolder), etherpad);
      await publishHandler(folder,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Needs to wait for
      let indexDocument = await meilisearchClient.index(itemIndex).getDocument(folder.id);
      expect(indexDocument).toEqual(expectedFolder);
      indexDocument = await meilisearchClient.index(itemIndex).getDocument(subFolderOne.id);
      expect(indexDocument).toEqual(expectedsubItemOne);
      indexDocument = await meilisearchClient.index(itemIndex).getDocument(subFolderTwo.id);
      expect(indexDocument).toEqual(expectedsubItemTwo);
      indexDocument = await meilisearchClient.index(itemIndex).getDocument(itemInSubFolder.id);
      expect(indexDocument).toEqual(expectedsubItemThree);
    });


    it('Publish document', async () => {
      const documentContent = 'this is a sample text for a document';
      const extra_info_document:DocumentItemExtraProperties = {content:documentContent};
      const options = {
        type:  ItemType.DOCUMENT,
        extra: buildDocumentExtra(extra_info_document),
      };
      const item = getDummyItem(options);
      const actor:Actor = {id:'lol',};
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
      await publishHandler(item,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(expected);
      expect(indexDocument.extra['content']).toEqual(documentContent);
      await app.close();
    });

    it('Publish local file', async () => {
      // Create a new PDFDocument
      const pdfDoc = await PDFDocument.create();
      const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 30;
      const pdfContent = 'PDF created at run time';
      page.drawText(pdfContent, {
        x: 50,
        y: height - 4 * fontSize,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0.53, 0.71),
      });
      // Serialize the PDFDocument to bytes (a Uint8Array)
      const pdfBytes = await pdfDoc.save();
      if (FILE_STORAGE_ROOT_PATH === undefined)
        throw new Error('storage path should not be undefined');
      
      const nameOfPDF = 'sample';
      const filePath = path.join(FILE_STORAGE_ROOT_PATH,nameOfPDF);
      writeFileSync(filePath, pdfBytes);

      const extra_info:FileItemProperties = {
        name: nameOfPDF,
        path: nameOfPDF,
        mimetype: 'pdf',
        size: 10,
      };
      
      const options = {
        type:  ItemType.LOCAL_FILE,
        extra: buildFileExtra(extra_info),
      };
      
      const item = getDummyItem(options);
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
      await publishHandler(item,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(expected);
      expect(indexDocument.extra['content']).toEqual(pdfContent);
      unlinkSync(filePath);
      await app.close();
    });


    it('Publish etherpad', async () => {
      const extra_info_document:EtherpadItemExtra = {
        [ItemType.ETHERPAD]: {
          padID: '',
          groupID: ''
        }
      };
      const options = {
        type:  ItemType.ETHERPAD,
        extra: extra_info_document,
      };
      const item = getDummyItem(options);
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const expected = await parseItem(<DiscriminatedItem>(item), etherpad);
      await publishHandler(item,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(expected);
      expect(indexDocument.extra['content']).toEqual(etherPadContent);
      await app.close();
    });

    it('Delete item', async () => {
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();
      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
        
      const folder = getDummyItem();
      const parsedFolder = await parseItem(<DiscriminatedItem>(folder), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);

      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
      
      //delete tiem
      await deleteHandler(folder,actor,{log});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait some seconds to process task
      await expect(() =>  meilisearchClient.index(itemIndex).getDocument(folder.id)).rejects.toThrow(/Document .* not found/);
      await app.close();

      
    });

    it('Update item', async () => {
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();
      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
        
      const folder = getDummyItem();
      const parsedFolder = await parseItem(<DiscriminatedItem>(folder), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);

      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
      folder.description = 'update text';
      await updateHandler(folder,actor,{log});
      const expectedFolder = await parseItem(<DiscriminatedItem>(folder), etherpad);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait some seconds to process task
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(folder.id);
      expect(indexDocument).toEqual(expectedFolder);
      await app.close();
    });


    it('Move published item from root to published folder', async () => {
      const item = getDummyItem();
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();
      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
        
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);

      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);


      jest.spyOn(itemTagService, 'hasTag').mockImplementationOnce(async (_dest,_tagID,_handler) => { return true;});
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'undefined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(parsedFolder);     
      await app.close();
    });


    it('Move published item from root to unpublished folder', async () => {
      const item = getDummyItem();
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();
      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);
      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
      jest.spyOn(itemTagService, 'hasTag')
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return false; })
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return true; });      
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'undefined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(parsedFolder);     
      await app.close();
    });
    
    it('Move unpublished item from root to published folder', async () => {

      const item = getDummyItem();

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      jest.spyOn(itemTagService, 'hasTag')
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return true; })
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return false; });      
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'undefined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(parsedFolder);     
      await app.close();
    });

    it('Move unpublished item from root to unpublished folder', async () => {
      const item = getDummyItem();
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      jest.spyOn(itemTagService, 'hasTag').mockImplementation(async (_dest, _tagID, _handler) => { return false; });
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'undefined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      await expect(() =>  meilisearchClient.index(itemIndex).getDocument(item.id)).rejects.toThrow(/Document .* not found/);
      await app.close();
    });
    
    it('Move published non-rooted item to published folder', async () => {

      const item = getDummyItem();
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();

      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);
      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
      jest.spyOn(itemTagService, 'hasTag').mockImplementationOnce(async (_dest,_tagID,_handler) => { return true;});
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'defined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(parsedFolder);     
      await app.close();
    });


    it('Move published non-rooted item to unpublished folder', async () => {

      const item = getDummyItem();
      const timeoutDuration = 5000; // Timeout duration in milliseconds
      const startTime = Date.now();

      let isReady = await meilisearchClient.isHealthy();
      while (!isReady) {
        isReady = await meilisearchClient.isHealthy();

        if (Date.now() - startTime >= timeoutDuration) {
          throw new Error('Timeout: Meilisearch did not become ready within the specified time.');
        }
      }

      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      const task = await meilisearchClient.index(itemIndex).addDocuments([parsedFolder]);
      const taskResult = meilisearchClient.waitForTask(task.taskUid);
      expect((await taskResult).status).toEqual(SearchTaskStatus.TASK_SUCCEEDED);
      jest.spyOn(itemTagService, 'hasTag')
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return false; })
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return true; });      
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'defined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      await expect(() =>  meilisearchClient.index(itemIndex).getDocument(item.id)).rejects.toThrow(/Document .* not found/);
      await app.close();
    });
    
    it('Move unpublished non-rooted item to published folder', async () => {
      const item = getDummyItem();
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      jest.spyOn(itemTagService, 'hasTag')
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return true; })
      .mockImplementationOnce(async (_dest, _tagID, _handler) => { return false; });      
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'defined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      const indexDocument = await meilisearchClient.index(itemIndex).getDocument(item.id);
      expect(indexDocument).toEqual(parsedFolder);     
      await app.close();
    });


    it('Move unpublished non-rooted item to unpublished folder', async () => {
      const item = getDummyItem();
      const {etherpad} = app;
      if (etherpad === undefined)
        throw Error('Error etherpad undefined'); 
      const parsedFolder = await parseItem(<DiscriminatedItem>(item), etherpad);
      jest.spyOn(itemTagService, 'hasTag').mockImplementation(async (_dest, _tagID, _handler) => { return false; });
      const dest = getDummyItem();
      moveHandler(item,actor,{log},{destination:dest,originalItemPath:'defined'});
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Needs to wait for enque operations Delay (1 second)
      await expect(() =>  meilisearchClient.index(itemIndex).getDocument(item.id)).rejects.toThrow(/Document .* not found/);
      await app.close();
    });
    
  });
});
