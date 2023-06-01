import { MeiliSearch, TaskStatus as SearchTaskStatus } from 'meilisearch';
import { Opts, stripHtml } from 'string-strip-html';

import { FastifyInstance, fastify } from 'fastify';

import { PadOptionalRev } from '@graasp/etherpad-api';
import {
  DiscriminatedItem,
  EtherpadService,
  Item,
  ItemType,
  getDocumentExtra,
  getEtherpadExtra,
  getFileExtra,
  getParentFromPath,
} from '@graasp/sdk';
import { ItemTagService } from 'graasp-item-tags';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

import { pdfToText } from 'pdf-to-text';

// import 'pdf-extract';


// import { PDFJS } from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';
// PDFJS.
import { getDocument, getXfaPageViewport, getPdfFilenameFromUrl } from 'pdfjs-dist';
// import {PadOptionalRev} from ''
import { MEILISEARCH_API_MASTERKEY, PUBLISHED_TAG_ID,FILE_STORAGE_ROOT_PATH } from '../../util/config';
import { constants } from 'fs/promises';
import pdf2img from 'pdf-img-convert';

async function getTextFromPDF(path_fle: string|Uint8Array|Buffer) {
  const pdfArray = await pdf2img.convert(path_fle);
  let content = '';
  console.log(pdfArray);
  for (let i = 0; i < pdfArray.length; i++){
    const filepath = path.join(FILE_STORAGE_ROOT_PATH, 'output'+i+'.png');
    fs.writeFile(filepath, pdfArray[i], function (error) {
      if (error) { console.error('Error: ' + error); }
    }); //writeFile

    try{
      content = content.concat((await Tesseract.recognize(filepath)).data.text);
    } catch(error){
      console.error('Error loading and rendering PDF:', error);
    }
  } // for

  console.log(content);
  return content;
}
  const stripOpts: Partial<Opts> = {
  ignoreTags: [],
  ignoreTagsWithTheirContents: [],
  onlyStripTags: [],
  stripTogetherWithTheirContents: ['script', 'style', 'xml'],
  skipHtmlDecoding: false,
  trimOnlySpaces: false,
  stripRecognisedHTMLOnly: false,
  dumpLinkHrefsNearby: {
    enabled: true,
    putOnNewLine: false,
    wrapHeads: '',
    wrapTails: '',
  },
  cb: null,
  reportProgressFunc: null,
  reportProgressFuncFrom: 0,
  reportProgressFuncTo: 100,
};

function removeHTMLTags(s: string): string {
  //is this the best way to delete html
  //are we sure that the users dont want to insert htmls tags in the conten
  if (s === null) return null;
  return stripHtml(s, stripOpts).result;
}
async function getSearchTextFromExtra(item: DiscriminatedItem, etherpad: EtherpadService) {
  const extraInfo = {};
  // local document is not being displayed, there is a problem loading it
  // let extraInfo = '';
  switch (item.type) {
    case ItemType.DOCUMENT:
      extraInfo['content'] = removeHTMLTags(getDocumentExtra(item.extra).content);
      break;
    case ItemType.LOCAL_FILE:
      const {name, mimetype, path : path_to_file} = getFileExtra(item.extra);
      extraInfo['mimetype'] = mimetype;
      const pathLocalFile = path.join(FILE_STORAGE_ROOT_PATH,path_to_file);
      if (name.toLowerCase().startsWith('scannedpdf'))
      {
        extraInfo['content'] = removeHTMLTags(await getTextFromPDF(pathLocalFile));
      } else if(mimetype === 'pdf'){

        const buffer = fs.readFileSync(pathLocalFile);
        const data = await pdf(buffer);
        extraInfo['content'] = removeHTMLTags(data.text);
      }
      break;
    case ItemType.ETHERPAD:
      const padID = getEtherpadExtra(item.extra).padID;
      const qs: PadOptionalRev = { padID: padID };
      const x = await etherpad.api.getText(qs);
      if (x !== null) {
        extraInfo['content'] = removeHTMLTags(x.text);
      }
      break;
  }
  return extraInfo;
}

export async function parseItem(item: DiscriminatedItem, etherpad: EtherpadService) {
  console.log('check here in case:' + (await getSearchTextFromExtra(item, etherpad)));
  return {
    id: item.id,
    name: item.name,
    description: removeHTMLTags(item.description),
    type: item.type,
    extra: await getSearchTextFromExtra(item, etherpad),
    creator: item.creator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    timestamp_creation: Date.parse(item.createdAt)/1000,
  };
}

const selSearchableAttr = ['name', 'description', 'extra', 'type'];
const selFilterAttr = ['type','extra.mimetype','timestamp_creation'];
const searchPlugin = async (
  instance: FastifyInstance,
  options: { tags: { service: ItemTagService },indexName:string },
) => {
  const {
    tags: { service: itemTagService },indexName:itemIndex
  } = options;
  //create indexes to store different filesmm
  const { publish, items, taskRunner, etherpad } = instance;
  const { taskManager: publishTaskManager } = publish;
  const { taskManager: itemsTaskManager, dbService: itemService } = items;
  const publishItemTaskName = publishTaskManager.getPublishItemTaskName();
  const updateItemTaskName = itemsTaskManager.getUpdateTaskName();
  const deleteItemTaskName = itemsTaskManager.getDeleteTaskName();
  const moveItemTaskName = itemsTaskManager.getMoveTaskName();
  // const itemIndex = 'testitem';


  const opts = {
    normalizeWhitespace: true,
  };


  // const pdfExtract = PDF();

  //  pdfToText('sample_ocr.pdf', { from: 0,to:1 }, (error, data) => {
  //   if (error) {
  //     console.error('Error extracting text:', error);
  //   } else {
  //     // Process the extracted text
  //     console.log(data.text);
  //   }
  // });


  // const pdf = await getDocument('./sample_ocr.pdf').promise;
  // for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  //   const page = await pdf.getPage(pageNum);
  // }
  // const buffer = fs.readFileSync('./sample_ocr.pdf');
  // const data = await pdf(buffer,opts);
  // console.log(data.text);

  const startTime = performance.now();
  // await getTextFromPDF('./sample_ocr.pdf');
  console.log(performance.now()-startTime);
  
  // await loadAndRenderPDF('sample_ocr.pdf');
  console.log(FILE_STORAGE_ROOT_PATH);
  const meilisearchClient = new MeiliSearch({
    host: 'http://meilisearch:8080',
    apiKey: MEILISEARCH_API_MASTERKEY,
  });



  const status = await meilisearchClient.isHealthy();
  if (status) {
    try {
      await meilisearchClient.getIndex(itemIndex);
    } catch (err) {
      const res = await meilisearchClient.createIndex(itemIndex);
      if (res.status !== SearchTaskStatus.TASK_SUCCEEDED) {
        console.log('Index' + itemIndex + 'could not be created');
      }
    }

    try{
      const resUpdateSearchAttr = await meilisearchClient.index(itemIndex).updateSearchableAttributes(selSearchableAttr);
      const resUpdateFilterAttr = await meilisearchClient.index(itemIndex).updateFilterableAttributes(selFilterAttr);

    }
    catch(err){
      console.log('Error: searchable attributes were not updated in Index:' + itemIndex);
    }
  }
  //on publish hook is not working correctly
  //if a folder is published, and then a new items is created
  //this does not gets triggered
  taskRunner.setTaskPostHookHandler<DiscriminatedItem>(
    publishItemTaskName,
    async (item, member, { log, handler }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

      try {
        await meilisearchClient.getIndex(itemIndex);
        const document = await parseItem(item, etherpad);
        const onPublishRes = await meilisearchClient.index(itemIndex).addDocuments([document]);
        // if (onPublishRes.status !== SearchTaskStatus.TASK_SUCCEEDED){
        //   console.log('Document can not be added: ');
        // }
      } catch (err) {
        console.log('There was a problem adding ' + item + 'to meilisearch ' + err);
      }
      
      // meilisearchClient
      //   .index(itemIndex)
      //   .updateSearchableAttributes(selSearchableAttr)
      //   .then(() => {
      //     console.log('Setting for searchable Attributes has changed');
      //   })
      //   .catch((err) => {
      //     console.log('There was an error changing the configuration of meilisearch db' + err);
      //   });

      if (item.type === ItemType.FOLDER) {
        try {
          const children: Item[] = await itemService.getDescendants(item, handler);
          children.forEach(async (child: DiscriminatedItem) => {
            const document = await parseItem(child, etherpad);
            const onPublishRes = await meilisearchClient.index(itemIndex).addDocuments([document]);
            // if (onPublishRes.status !== SearchTaskStatus.TASK_SUCCEEDED){
            //   console.log('Document can not be added: ');
            // }
          });
        } catch (err) {
          console.log('There was a problem adding the children from the item');
        }
      }
    },
  );

  taskRunner.setTaskPreHookHandler<DiscriminatedItem>(
    deleteItemTaskName,
    async (item, member, { log, handler }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

      try {
        await meilisearchClient.getIndex(itemIndex);
        const onDeleteRes = await meilisearchClient.index(itemIndex).deleteDocument(item.id);
        if (onDeleteRes.status !== SearchTaskStatus.TASK_SUCCEEDED) {
          console.log('Document can not be deleted: ');
        }
      } catch (err) {
        console.log('There was a problem deleting ' + item + 'to meilisearch ' + err);
      }
    },
  );

  taskRunner.setTaskPostHookHandler<DiscriminatedItem>(
    updateItemTaskName,
    async (item, member, { log, handler }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

      try {
        await meilisearchClient.getIndex(itemIndex);
        const document = await parseItem(item, etherpad);
        const onUpdateRes = await meilisearchClient.index(itemIndex).updateDocuments([document]);
        if (onUpdateRes.status !== SearchTaskStatus.TASK_SUCCEEDED) {
          console.log('Document can not be updated: ');
        }
      } catch (err) {
        console.log('There was a problem deleting ' + item + 'to meilisearch ' + err);
      }
    },
  );

  taskRunner.setTaskPostHookHandler<DiscriminatedItem>(
    moveItemTaskName,
    async (item, member, { log, handler }, { original }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

      const originalParentID = getParentFromPath(original.path);
      const wasARoot = (originalParentID === undefined);

      const parentID = getParentFromPath(item.path);
      let published = false;
      if (parentID !== undefined && !wasARoot) {
        const parent = await itemService.get(parentID, handler);
        published = await itemTagService.hasTag(parent, PUBLISHED_TAG_ID, handler);
      } else {
        //this is a root, and therefore we should check if this is published
        published = await itemTagService.hasTag(item, PUBLISHED_TAG_ID, handler);
        if (parentID != null && !published) {
          const parent = await itemService.get(parentID, handler);
          published = await itemTagService.hasTag(parent, PUBLISHED_TAG_ID, handler);
        }
        console.log('the top file published res' + published);
      }
      try {
        await meilisearchClient.getIndex(itemIndex);

        if (published) {
          const document = await parseItem(item, etherpad);
          await meilisearchClient.index(itemIndex).updateDocuments([document]);
        } else {
          try {
            await meilisearchClient.index(itemIndex).getDocument(item.id);
            await meilisearchClient.index(itemIndex).deleteDocument(item.id);
          } catch {
            //the item has never been published
          }
        }
      } catch (err) {
        console.log('There was a problem in moving operations: ' + err);
      }
    },
  );
};

export default searchPlugin;
