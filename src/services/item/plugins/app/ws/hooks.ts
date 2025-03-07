import { FastifyPluginAsync } from 'fastify';

import { AppDataVisibility, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { AuthorizationService } from '../../../../authorization';
import { WebsocketService } from '../../../../websockets/ws-service';
import { BasicItemService } from '../../../basic.service';
import { AppActionService } from '../appAction/appAction.service';
import { AppDataService } from '../appData/appData.service';
import { AppSettingService } from '../appSetting/service';
import {
  AppDataEvent,
  AppSettingEvent,
  appActionsTopic,
  appDataTopic,
  appSettingsTopic,
} from './events';
import { checkItemIsApp } from './utils';

/**
 * helper to register app action topic
 */
function registerAppActionTopic(
  websockets: WebsocketService,
  appActionService: AppActionService,
  basicItemService: BasicItemService,
) {
  const authorizationService = resolveDependency(AuthorizationService);
  websockets.register(appActionsTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await basicItemService.get(db, member, id);
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
  basicItemService: BasicItemService,
) {
  const authorizationService = resolveDependency(AuthorizationService);
  websockets.register(appSettingsTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await basicItemService.get(db, member, id);
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
) => {
  const { websockets } = fastify;

  /**
   * helper to register app data topic
   */
  const authorizationService = resolveDependency(AuthorizationService);
  const basicItemService = resolveDependency(BasicItemService);
  // const appDataService = resolveDependency(AppDataService);

  websockets.register(appDataTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await basicItemService.get(db, member, id);
    await authorizationService.validatePermission(db, PermissionLevel.Read, member, item);
    checkItemIsApp(item);
  });

  // on post app data, notify apps of new app data
  // appDataService.hooks.setPostHook('post', async (member, thisDb, { appData, itemId }) => {
  //   if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
  //     websockets.publish(appDataTopic, itemId, AppDataEvent('post', appData));
  //   }
  // });

  // appDataService.hooks.setPostHook('patch', async (member, thisDb, { appData, itemId }) => {
  //   if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
  //     websockets.publish(appDataTopic, itemId, AppDataEvent('patch', appData));
  //   }
  // });

  // appDataService.hooks.setPostHook('delete', async (member, thisDb, { appData, itemId }) => {
  //   if (itemId !== undefined && appData.visibility === AppDataVisibility.Item) {
  //     websockets.publish(appDataTopic, itemId, AppDataEvent('delete', appData));
  //   }
  // });
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
  const basicItemService = resolveDependency(BasicItemService);
  registerAppActionTopic(websockets, appActionService, basicItemService);
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
  const basicItemService = resolveDependency(BasicItemService);
  registerAppSettingsTopic(websockets, appSettingService, basicItemService);
};
