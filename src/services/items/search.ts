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
// import 'pdf-extract';


// import { PDFJS } from 'pdfjs-dist/build/pdf';
import Tesseract from 'tesseract.js';
// PDFJS.

import { getDocument, getXfaPageViewport, getPdfFilenameFromUrl } from 'pdfjs-dist';

// import {PadOptionalRev} from ''
import { MEILISEARCH_API_MASTERKEY, PUBLISHED_TAG_ID,FILE_STORAGE_ROOT_PATH } from '../../util/config';
import { constants } from 'fs/promises';



//code taken from chatGPT for prototyping 
const loadAndRenderPDF = async (pdfPath) => {
  try {

    fs.access(pdfPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error('File does not exist.');
        return;
      }
    
      console.log('File exists.');
    });
    const loadingTask = getDocument(pdfPath);
    console.log('ok');

    loadingTask.promise.then((pdf) => {
      console.log(pdf.numPages);
    }).catch((err) => {
      console.log(err);
      return;
    });
    const pdf = await loadingTask.promise;
    console.log('problem here');
    const numPages = pdf.numPages;
    console.log(numPages);
    // Render each page of the PDF
    for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      console.log('here');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;
      console.log('problem here');
      // Perform OCR on the rendered image
      const imageDataURL = canvas.toDataURL(); // Convert canvas to data URL
      const result = await Tesseract.recognize(imageDataURL, 'eng');
      const text = result.data.text;

      // Handle the OCR result as needed
      console.log(`Page ${pageIndex} OCR Result:`, text);
    }
  } catch (error) {
    console.error('Error loading and rendering PDF:', error);
  }
};

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
  // let extraInfo = {};
  // local document is not being displayed, there is a problem loading it
  let extraInfo = '';
  switch (item.type) {
    case ItemType.DOCUMENT:
      extraInfo = removeHTMLTags(getDocumentExtra(item.extra).content);
      break;
    case ItemType.LOCAL_FILE:
      const path_to_file = getFileExtra(item.extra).path;
      const {name, mimetype} = getFileExtra(item.extra);
      const pathLocalFile = path.join(FILE_STORAGE_ROOT_PATH,path_to_file);
      console.log(pathLocalFile);
      await loadAndRenderPDF(pathLocalFile);
      // const buffer = fs.readFileSync(pathLocalFile);
      // if (name.toLowerCase().startsWith('scannedpdf'))
      // {
        
      //   const options = {
      //     type: 'ocr' // perform ocr to get the text within the scanned image
      //   };
         
      //   // const processor = pdf_extract(absolute_path_to_pdf, options, function(err) {
      //   //   if (err) {
      //   //     return callback(err);
      //   //   }
      //   // });
      //   // processor.on('complete', function(data) {
      //   //   inspect(data.text_pages, 'extracted text pages');
      //   //   callback(null, text_pages);
      //   // });
      //   // processor.on('error', function(err) {
      //   //   inspect(err, 'error while extracting pages');
      //   //   return callback(err);
      //   // });
        
      // } else{
      //   const data = await pdf(buffer);
      //   extraInfo = removeHTMLTags(data.text);
      // }
      // extraInfo = (<FileItemProperties>extraProp[item.type]).path;
      break;
    case ItemType.ETHERPAD:
      const padID = getEtherpadExtra(item.extra).padID;
      const qs: PadOptionalRev = { padID: padID };
      const x = await etherpad.api.getText(qs);
      if (x !== null) {
        extraInfo = removeHTMLTags(x.text);
      }
      break;
  }
  return extraInfo;
}

async function parseItem(item: DiscriminatedItem, etherpad: EtherpadService) {
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
  };
}

const selSearchableAttr = ['name', 'description', 'extra'];
const searchPlugin = async (
  instance: FastifyInstance,
  options: { tags: { service: ItemTagService } },
) => {
  const {
    tags: { service: itemTagService },
  } = options;
  //create indexes to store different filesmm
  const { publish, items, db, taskRunner, etherpad } = instance;
  const { taskManager: publishTaskManager } = publish;
  const { taskManager: itemsTaskManager, dbService: itemService } = items;
  const { pool } = db;
  const publishItemTaskName = publishTaskManager.getPublishItemTaskName();
  const updateItemTaskName = itemsTaskManager.getUpdateTaskName();
  const deleteItemTaskName = itemsTaskManager.getDeleteTaskName();
  const moveItemTaskName = itemsTaskManager.getMoveTaskName();
  const itemIndex = 'testitem';
  
  await loadAndRenderPDF('sample_ocr.pdf');
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

      meilisearchClient
        .index(itemIndex)
        .updateSearchableAttributes(selSearchableAttr)
        .then(() => {
          console.log('Setting for searchable Attributes has changed');
        })
        .catch((err) => {
          console.log('There was an error changing the configuration of meilisearch db' + err);
        });

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

  let wasARoot = false;
  taskRunner.setTaskPreHookHandler<DiscriminatedItem>(
    moveItemTaskName,
    async (item, member, { log, handler }) => {
      wasARoot = false;
      const parentID = getParentFromPath(item.path);
      if (parentID === undefined) {
        wasARoot = true;
      }
    },
  );

  taskRunner.setTaskPostHookHandler<DiscriminatedItem>(
    moveItemTaskName,
    async (item, member, { log, handler }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

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
