import { EnqueuedTask, MeiliSearch, TaskStatus as SearchTaskStatus } from 'meilisearch';
import path from 'path';
import { readPdfText } from 'pdf-text-reader';
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

import {
  FILE_STORAGE_ROOT_PATH,
  MEILISEARCH_API_MASTERKEY,
  PUBLISHED_TAG_ID,
} from '../../util/config';

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
  if (s === null) return null;
  return stripHtml(s, stripOpts).result;
}

async function logTaskCompletion(
  client: MeiliSearch,
  index: string,
  enqueTask: EnqueuedTask,
  itemName: string,
) {
  const task = await client.index(index).waitForTask(enqueTask.taskUid);
  if (task.status === SearchTaskStatus.TASK_SUCCEEDED) {
    console.log('item name:', itemName, ', task type:', task.type, ', Successful task');
  } else {
    console.log(
      'item name:',
      itemName,
      ', task type:',
      task.type,
      ', Timeout or Unsuccessful task',
      ', error:',
      task.error,
    );
  }
}
async function getSearchTextFromExtra(item: DiscriminatedItem, etherpad: EtherpadService) {
  const extraInfo = {};
  switch (item.type) {
    case ItemType.DOCUMENT:
      extraInfo['content'] = removeHTMLTags(getDocumentExtra(item.extra).content);
      break;
    case ItemType.LOCAL_FILE:
      const { name, mimetype, path: path_to_file } = getFileExtra(item.extra);
      extraInfo['mimetype'] = mimetype;
      const pathLocalFile = path.join(FILE_STORAGE_ROOT_PATH, path_to_file);
      if (mimetype === 'pdf') {
        let content = '';
        try {
          const pages = await readPdfText(pathLocalFile);
          //adding more than x pages could not be useful for indexing
          const maxPage = Math.min(pages.length, 10);
          for (let i = 0; i < maxPage; i++) {
            content += pages[i].lines.join('');
          }
        } catch (err) {
          console.log('item:', item.name, 'error parsing content:', err);
        }
        extraInfo['content'] = removeHTMLTags(content);
      }
      break;
    case ItemType.ETHERPAD:
      const padID = getEtherpadExtra(item.extra).padID;
      const qs: PadOptionalRev = { padID: padID };
      const contentEtherpad = await etherpad.api.getText(qs);
      if (contentEtherpad !== null) {
        extraInfo['content'] = removeHTMLTags(contentEtherpad.text);
      }
      console.log(extraInfo['content']);
      break;
  }
  return extraInfo;
}

export async function parseItem(item: DiscriminatedItem, etherpad: EtherpadService) {
  return {
    id: item.id,
    name: item.name,
    description: removeHTMLTags(item.description),
    type: item.type,
    extra: await getSearchTextFromExtra(item, etherpad),
    creator: item.creator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    timestamp_creation: Date.parse(item.createdAt) / 1000,
  };
}

const selSearchableAttr = ['name', 'description', 'extra', 'type'];
const selFilterAttr = ['type', 'extra.mimetype', 'timestamp_creation'];
const searchPlugin = async (
  instance: FastifyInstance,
  options: { tags: { service: ItemTagService }; indexName: string },
) => {
  const {
    tags: { service: itemTagService },
    indexName: itemIndex,
  } = options;
  //create indexes to store different filesmm
  const { publish, items, taskRunner, etherpad } = instance;
  const { taskManager: publishTaskManager } = publish;
  const { taskManager: itemsTaskManager, dbService: itemService } = items;
  const publishItemTaskName = publishTaskManager.getPublishItemTaskName();
  const updateItemTaskName = itemsTaskManager.getUpdateTaskName();
  const deleteItemTaskName = itemsTaskManager.getDeleteTaskName();
  const moveItemTaskName = itemsTaskManager.getMoveTaskName();

  const opts = {
    normalizeWhitespace: true,
  };
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
    }

    try {
      const resUpdateSearchAttr = await meilisearchClient
        .index(itemIndex)
        .updateSearchableAttributes(selSearchableAttr);
      const resUpdateFilterAttr = await meilisearchClient
        .index(itemIndex)
        .updateFilterableAttributes(selFilterAttr);
    } catch (err) {
      console.log('Error: searchable/filterable attributes were not updated in Index:' + itemIndex);
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
        logTaskCompletion(meilisearchClient, itemIndex, onPublishRes, item.name);
      } catch (err) {
        console.log('There was a problem adding ' + item + 'to meilisearch ' + err);
      }

      if (item.type === ItemType.FOLDER) {
        try {
          const children: Item[] = await itemService.getDescendants(item, handler);
          children.forEach(async (child: DiscriminatedItem) => {
            const document = await parseItem(child, etherpad);
            const onPublishRes = await meilisearchClient.index(itemIndex).addDocuments([document]);
            logTaskCompletion(meilisearchClient, itemIndex, onPublishRes, child.name);
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
        logTaskCompletion(meilisearchClient, itemIndex, onDeleteRes, item.name);
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
        logTaskCompletion(meilisearchClient, itemIndex, onUpdateRes, item.name);
      } catch (err) {
        console.log('There was a problem deleting ' + item + 'to meilisearch ' + err);
      }
    },
  );

  taskRunner.setTaskPostHookHandler<DiscriminatedItem>(
    moveItemTaskName,
    async (item, member, { log, handler }, { destination, originalItemPath }) => {
      const isReady = await meilisearchClient.isHealthy();
      if (!isReady) {
        return;
      }

      const originalParentID = getParentFromPath(originalItemPath);
      const wasARoot = originalParentID === undefined;
      let published = false;
      if (destination !== undefined) {
        published = await itemTagService.hasTag(destination, PUBLISHED_TAG_ID, handler);
        console.log('it is working', published);
      }
      if (wasARoot) {
        //if this was moved from root, check if item was published before

        console.log('it is working', published);
        published = published || (await itemTagService.hasTag(item, PUBLISHED_TAG_ID, handler));
        console.log('it is working', published);
      }

      let documentInMeilisearchDB = undefined;
      try {
        documentInMeilisearchDB = await meilisearchClient.index(itemIndex).getDocument(item.id);
      } catch {
        //skip check item exists
      }

      try {
        await meilisearchClient.getIndex(itemIndex);
        const document = await parseItem(item, etherpad);
        let taskRes = undefined;
        if (published && documentInMeilisearchDB === undefined) {
          taskRes = await meilisearchClient.index(itemIndex).addDocuments([document]);
        } else if (published) {
          taskRes = await meilisearchClient.index(itemIndex).updateDocuments([document]);
        } else if (documentInMeilisearchDB !== undefined) {
          taskRes = await meilisearchClient.index(itemIndex).deleteDocument(item.id);
        }
        if (taskRes !== undefined)
          logTaskCompletion(meilisearchClient, itemIndex, taskRes, item.name);
      } catch (err) {
        console.log('There was a problem in moving operations: ' + err);
      }
    },
  );
};

export default searchPlugin;
