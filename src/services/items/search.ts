import {fastify, FastifyInstance} from 'fastify';
import { MeiliSearch } from 'meilisearch';
import {
    Item,
    getParentFromPath,
    DocumentItemExtraProperties,
    FileItemProperties,
    EtherpadItemExtraProperties,
  } from '@graasp/sdk';

import { PUBLISHED_TAG_ID } from '../../util/config';
import { ItemTagService } from 'graasp-item-tags';


interface customDocument{
    id: string;
    name: string;
    description: string;
    type: string;
    extra: string;
    creator: string;
    createdAt: string;
    updatedAt: string;
}

function removeHTMLTags(s:string):string {
  //is this the best way to delete html 
  //are we sure that the users dont want to insert htmls tags in the conten
  if (s == null)
    return null;
  const regx = /<[^>]+>/g;
  return s.replace(regx,'');
}
function getSearchTextFromExtra(item:Item): string{

  // let extraInfo = {};
  // local document is not being displayed, there is a problem loading it
  console.log('enter here');
  let extraInfo = '';
  const extraProp = item.extra;
  switch (item.type.toString()){
    case 'document':
      extraInfo = removeHTMLTags((<DocumentItemExtraProperties>extraProp[item.type]).content);
      break;
    case 'file':
      // extraInfo = (<FileItemProperties>extraProp[item.type]).path;
      break;
    case 'etherpad':
      const padID = (<EtherpadItemExtraProperties>extraProp[item.type]).padID;
      extraInfo = 'TO-DO' + padID;
      break;
  }
  return extraInfo;
}

function parseItem(item:Item): customDocument {
  const document: customDocument = {
    id: item.id,
    name: item.name,
    description: removeHTMLTags(item.description),
    type: item.type.toString(),
    extra: getSearchTextFromExtra(item),
    creator: item.creator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  return document;
}

const selSearchableAttr = ['name','description','extra'];
const searchPlugin = async (instance:FastifyInstance, options: { tags: { service: ItemTagService }}) => {
          const { tags: { service: itemTagService }} = options;
          //create indexes to store different filesmm
          const { publish, items, db } = instance;
          const { taskManager: publishTaskManager } = publish;
          const { taskManager: itemsTaskManager, dbService: itemService } = items;
          const { pool } = db;
          const { taskRunner } = instance;
          const publishItemTaskName = publishTaskManager.getPublishItemTaskName();
          const updateItemTaskName = itemsTaskManager.getUpdateTaskName();
          const deleteItemTaskName = itemsTaskManager.getDeleteTaskName();
          const moveItemTaskName = itemsTaskManager.getMoveTaskName();
          const itemIndex = 'testitem';
          // itemsTaskManager.get
          
          const meilisearchClient = new MeiliSearch({
            host: 'http://meilisearch:8080',
            apiKey: '2416ed3f3e8d109faa75f415e2c04ba27eec5da31cbacaaa9bd8832655d1',
          });

          const status = await meilisearchClient.isHealthy();
          if (status) {
            meilisearchClient.getIndex(itemIndex).catch(() => {
              meilisearchClient.createIndex(itemIndex).then(res => {
                console.log('Create new index:' + itemIndex);
              })
              .catch(err => {
                 console.log('Error creating index:' + itemIndex + ' err: ' + err);
              });
            });
          }

          //on publish hook is not working correctly
          //if a folder is published, and then a new items is created 
          //this does not gets triggered
          taskRunner.setTaskPostHookHandler<Item>(
            publishItemTaskName,
            async (item, member, { log, handler }) => {

              meilisearchClient.isHealthy().then(() => {
                meilisearchClient.getIndex(itemIndex).catch(err => {
                  console.log('Document can not be added: ' + err);
                });
                
                // const jsonChildItem = JSON.string
                meilisearchClient.index(itemIndex).addDocuments([parseItem(item)]).then(() => {
                  console.log('Item added to meilisearch');
                }).catch(err => {
                  console.log('There was a problem adding ' + item + 'to meilisearch ' + err);
                });

              }).catch(err => {
                console.log('Server is not healthy' + err);
              });
              
              meilisearchClient.index(itemIndex).updateSearchableAttributes(selSearchableAttr).then(() => {
                console.log('Setting for searchable Attributes has changed');
              }).catch( err => {
                console.log('There was an error changing the configuration of meilisearch db' + err);
              });
              if (item.type == 'folder'){
                (itemService.getDescendants(item, handler)).then(children=>{
                  children.forEach(childItem => {
                    meilisearchClient.isHealthy().then(() => {
                      meilisearchClient.getIndex(itemIndex).catch(err => {
                        console.log('Document can not be added: ' + err);
                      });
                      
                      // const jsonChildItem = JSON.string
                      meilisearchClient.index(itemIndex).addDocuments([parseItem(childItem)]).then(() => {
                        console.log('Item added to meilisearch');
                      }).catch(err => {
                        console.log('There was a problem adding ' + childItem + 'to meilisearch ' + err);
                      });
  
                    }).catch(err => {
                      console.log('Server is not healthy' + err);
                    });
  
                  });
                });
              }
            },
          );
          

          taskRunner.setTaskPreHookHandler<Item>(
            deleteItemTaskName,
            async (item, member, { log, handler }) => {
                meilisearchClient.isHealthy().then(() => {
                    meilisearchClient.getIndex(itemIndex).catch(err => {
                      console.log('Document can not be deleted: ' + err);
                    });
                    
                    meilisearchClient.index(itemIndex).deleteDocument(item.id).then(() => {
                      console.log('Item deleted');
                    }).catch(err => {
                      console.log('There was a problem deleting ' + item + 'to meilisearch ' + err);
                    });
    
                  }).catch(err => {
                    console.log('Server is not healthy' + err);
                  });
            },

          );


          taskRunner.setTaskPostHookHandler<Item>(
            updateItemTaskName,
            async (item, member, { log, handler }) => {
                meilisearchClient.isHealthy().then(() => {
                    meilisearchClient.getIndex(itemIndex).catch(err => {
                      console.log('Document can not be deleted: ' + err);
                    });
                    
                    meilisearchClient.index(itemIndex).updateDocuments([parseItem(item)]).then(() => {
                      console.log('Item updated');
                    }).catch(err => {
                      console.log('There was a problem updating ' + item + 'to meilisearch ' + err);
                    });
    
                  }).catch(err => {
                    console.log('Server is not healthy' + err);
                  });
            },

          );
          
          let wasARoot = false;
          taskRunner.setTaskPreHookHandler<Item>(
            moveItemTaskName,
            async (item, member, { log, handler }) => {
                wasARoot = false;
                const parentID = getParentFromPath(item.path);
                if (parentID === undefined){
                  wasARoot = true;
                } 
              },
          );

          taskRunner.setTaskPostHookHandler<Item>(
            moveItemTaskName,
            async (item, member, { log, handler }) => {
                const isReady = await meilisearchClient.isHealthy();
                if (!isReady) {
                  return;
                }

                const parentID = getParentFromPath(item.path);
                let published = false;
                if (parentID !== undefined && !wasARoot)
                {
                  
                  const parent = await itemService.get(parentID, handler);
                  published = await itemTagService.hasTag(parent, PUBLISHED_TAG_ID,handler);
                } 
                else 
                {
                  //this is a root, and therefore we should check if this is published
                  published = await itemTagService.hasTag(item, PUBLISHED_TAG_ID,handler);
                  if (parentID != null && !published)
                  {
                    const parent = await itemService.get(parentID, handler);
                    published = await itemTagService.hasTag(parent, PUBLISHED_TAG_ID,handler);
                  }
                  console.log('the top file published res' + published);
                }
                try
                {
                  await  meilisearchClient.getIndex(itemIndex);
                  
                  if(published) {
                    await meilisearchClient.index(itemIndex).updateDocuments([parseItem(item)]);
                  } else {

                    try
                    {
                      await meilisearchClient.index(itemIndex).getDocument(item.id);
                      await meilisearchClient.index(itemIndex).deleteDocument(item.id);
                    }
                    catch
                    {
                      //the item has never been published
                    }
                  }
                }
                catch(err){
                  console.log('There was a problem in moving operations: ' + err);
                }
            },

          );




        };





        

export default searchPlugin;
