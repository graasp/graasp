import { FastifyPluginAsync } from 'fastify';

import { FileItemType, Hostname, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  hosts: Hostname[];
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify, options) => {
  // set hook handlers if can save actions
  // if (shouldSave) {
  //   // save action when an item is created
  //   // we cannot use the onResponse hook in this case because in the creation of an item
  //   // the response object does not provide the item id (it is created later), therefore we do not have information about the item
  //   // todo: with a refactor, this posthookhandler can be defined in the core in the item service
  //   const createItemTaskName = itemTaskManager.getCreateTaskName();
  //   runner.setTaskPostHookHandler(
  //     createItemTaskName,
  //     async (item: Partial<Item>, actor, { handler }) => {
  //       const member = actor as Member;
  //       const extra = { memberId: actor.id, itemId: item.id };
  //       // create only happens in builder
  //       const view = VIEW_BUILDER_NAME;
  //       const geolocation = null;
  //       const action: Action = new BaseAction({
  //         memberId: actor.id,
  //         itemPath: item.path,
  //         memberType: member.type,
  //         itemType: item.type,
  //         actionType: ACTION_TYPES.CREATE,
  //         view,
  //         geolocation,
  //         extra,
  //       });
  //       await actionService.create(action, handler);
  //     },
  //   );
  //   // save action when an item is deleted
  //   // we cannot use the onResponse hook in this case because when an item is deleted
  //   // the onResponse hook is executed after the item is removed, therefore we do not have information about the item
  //   // todo: with a refactor, this posthookhandler can be defined in the core in the item service
  //   const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
  //   runner.setTaskPostHookHandler(
  //     deleteItemTaskName,
  //     async (item: Partial<Item>, actor, { handler }) => {
  //       const member = actor as Member;
  //       const extra = { memberId: actor.id, itemId: item.id };
  //       // delete only happens in builder
  //       const view = VIEW_BUILDER_NAME;
  //       const geolocation = null;
  //       // cannot add item path because it will be removed from the db
  //       const action: Action = new BaseAction({
  //         memberId: actor.id,
  //         memberType: member.type,
  //         itemPath: null,
  //         itemType: item.type,
  //         actionType: ACTION_TYPES.DELETE,
  //         view,
  //         geolocation,
  //         extra,
  //       });
  //       actionService.create(action, handler);
  //     },
  //   );
  // }
  // TODO post action endpoint
};

export default plugin;
