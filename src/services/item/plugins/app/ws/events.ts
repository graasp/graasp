/**
 * App websocket events are registered under these topics
 */
import { AppAction, AppSetting } from '@graasp/sdk';

import { AppData } from '../appData/appData';

// changes on app entities
export const appDataTopic = 'app-data';
export const appActionsTopic = 'app-actions';
export const appSettingsTopic = 'app-settings';
// changes on items of given user
// export const memberItemsTopic = 'item/member';

type AppOperations = 'post' | 'patch' | 'delete';

/**
 * All websocket events for app will have this shape
 */
interface AppEvent {
  kind: string;
  op: AppOperations;
}

/**
 * Events that affect an app data
 */
interface AppDataEvent extends AppEvent {
  kind: 'app-data';
  appData: AppData;
}

/**
 * Factory of AppDataEvent
 * @param op operation of the event
 * @param appData value of the appData for this event
 * @returns instance of app data event
 */
export const AppDataEvent = (op: AppDataEvent['op'], appData: AppData): AppDataEvent => ({
  kind: 'app-data',
  op,
  appData,
});

/**
 * Events that affect an app action
 */
interface AppActionEvent extends AppEvent {
  kind: 'app-actions';
  appAction: AppAction;
}

/**
 * Factory of AppActionEvent
 * @param op operation of the event
 * @param appAction value of the app action for this event
 * @returns instance of app action event
 */
export const AppActionEvent = (op: AppActionEvent['op'], appAction: AppAction): AppActionEvent => ({
  kind: 'app-actions',
  op,
  appAction,
});

/**
 * Events that affect an app setting
 */
interface AppSettingEvent extends AppEvent {
  kind: 'app-settings';
  appSetting: AppSetting;
}

/**
 * Factory of AppSettingEvent
 * @param op operation of the event
 * @param appAction value of the app setting for this event
 * @returns instance of app setting event
 */
export const AppSettingEvent = (
  op: AppSettingEvent['op'],
  appSetting: AppSetting,
): AppSettingEvent => ({
  kind: 'app-settings',
  op,
  appSetting,
});
