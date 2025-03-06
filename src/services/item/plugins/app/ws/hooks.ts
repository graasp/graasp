import { FastifyPluginAsync } from 'fastify';

import { AppDataVisibility, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { AuthorizationService } from '../../../../authorization';
import { WebsocketService } from '../../../../websockets/ws-service';
import { ItemService } from '../../../service';
import { AppActionService } from '../appAction/appAction.service';
import { AppDataService } from '../appData/service';
import { AppSettingService } from '../appSetting/service';
import {
  AppActionEvent,
  AppDataEvent,
  AppSettingEvent,
  appActionsTopic,
  appDataTopic,
  appSettingsTopic,
} from './events';
import { checkItemIsApp } from './utils';

/**
 * helper to register app data topic
 */
function registerAppDataTopic(
  websockets: WebsocketService,
  appDataService: AppDataService,
  itemService: ItemService,
) {
  const authorizationService = resolveDependency(AuthorizationService);

  websockets.register(appDataTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await itemService.get(db, member, id);
    await authorizationService.validatePermission(db, PermissionLevel.Read, member, item);
    checkItemIsApp(item);
  });

  // on post app data, notify apps of new app data
  appDataService.hooks.setPostHook('post', async (member, thisDb, { appData, itemId }) => {
    if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
      websockets.publish(appDataTopic, itemId, AppDataEvent('post', appData));
    }
  });

  appDataService.hooks.setPostHook('patch', async (member, thisDb, { appData, itemId }) => {
    if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
      websockets.publish(appDataTopic, itemId, AppDataEvent('patch', appData));
    }
  });

  appDataService.hooks.setPostHook('delete', async (member, thisDb, { appData, itemId }) => {
    if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
      websockets.publish(appDataTopic, itemId, AppDataEvent('delete', appData));
    }
  });
}

/**
 * helper to register app action topic
 */
function registerAppActionTopic(
  websockets: WebsocketService,
  appActionService: AppActionService,
  itemService: ItemService,
) {
  const authorizationService = resolveDependency(AuthorizationService);
  websockets.register(appActionsTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await itemService.get(db, member, id);
    await authorizationService.validatePermission(db, PermissionLevel.Admin, member, item);
    checkItemIsApp(item);
  });

  // TODO ENABLE!!
  // on post app action, notify apps of new app action
  // appActionService.hooks.setPostHook('post', async (member, { appAction, itemId }) => {
  //   if (itemId !== undefined) {
  //     websockets.publish(appActionsTopic, itemId, AppActionEvent('post', appAction));
  //   }
  // });
}

/**
 * helper to register app setting topic
 */
function registerAppSettingsTopic(
  websockets: WebsocketService,
  appSettingService: AppSettingService,
  itemService: ItemService,
) {
  const authorizationService = resolveDependency(AuthorizationService);
  websockets.register(appSettingsTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await itemService.get(db, member, id);
    await authorizationService.validatePermission(db, PermissionLevel.Read, member, item);
    checkItemIsApp(item);
  });

  // on post app data, notify apps of new app data
  appSettingService.hooks.setPostHook('post', async (member, thisDb, { appSetting, itemId }) => {
    if (itemId !== undefined) {
      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('post', appSetting));
    }
  });

  appSettingService.hooks.setPostHook('patch', async (member, thisDb, { appSetting, itemId }) => {
    if (itemId !== undefined) {
      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('patch', appSetting));
    }
  });

  appSettingService.hooks.setPostHook('delete', async (member, thisDb, { appSetting, itemId }) => {
    if (itemId !== undefined) {
      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('delete', appSetting));
    }
  });
}

interface GraaspPluginAppDataWsHooksOptions {
  appDataService: AppDataService;
}

/**
 * Registers real-time websocket events for the app data service
 */
export const appDataWsHooks: FastifyPluginAsync<GraaspPluginAppDataWsHooksOptions> = async (
  fastify,
  options,
) => {
  const { websockets } = fastify;
  const { appDataService } = options;
  const itemService = resolveDependency(ItemService);
  registerAppDataTopic(websockets, appDataService, itemService);
};

interface GraaspPluginAppActionsWsHooksOptions {
  appActionService: AppActionService;
}

/**
 * Registers real-time websocket events for the app action service
 */
export const appActionsWsHooks: FastifyPluginAsync<GraaspPluginAppActionsWsHooksOptions> = async (
  fastify,
  options,
) => {
  const { websockets } = fastify;
  const { appActionService } = options;
  const itemService = resolveDependency(ItemService);
  registerAppActionTopic(websockets, appActionService, itemService);
};

interface GraaspPluginAppSettingsWsHooksOptions {
  appSettingService: AppSettingService;
}

/**
 * Registers real-time websocket events for the app setting service
 */
export const appSettingsWsHooks: FastifyPluginAsync<GraaspPluginAppSettingsWsHooksOptions> = async (
  fastify,
  options,
) => {
  const { websockets } = fastify;
  const { appSettingService } = options;
  const itemService = resolveDependency(ItemService);
  registerAppSettingsTopic(websockets, appSettingService, itemService);
};
