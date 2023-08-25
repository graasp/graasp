/**
 * App websocket events are registered under these topics
 */
import { AppAction } from '../appAction/appAction';
import { AppData } from '../appData/appData';
import { AppSetting } from '../appSetting/appSettings';

// changes on app entities
// TODO: Move these topics to graasp/sdk
export const appDataTopic = 'app-data';
export const appActionsTopic = 'app-actions';
export const appSettingsTopic = 'app-settings';

type AppOperations = 'post' | 'patch' | 'delete';

/**
 * All websocket events for app will have this shape
 */
interface AppEvent {
  kind: typeof appDataTopic | typeof appActionsTopic | typeof appSettingsTopic;
  op: AppOperations;
}

/**
 * Events that affect an app data
 */
interface AppDataEvent extends AppEvent {
  kind: typeof appDataTopic;
  appData: AppData;
}

/**
 * Factory of AppDataEvent
 * @param op operation of the event
 * @param appData value of the appData for this event
 * @returns instance of app data event
 */
export const AppDataEvent = (op: AppDataEvent['op'], appData: AppData): AppDataEvent => ({
  kind: appDataTopic,
  op,
  appData,
});

/**
 * Events that affect an app action
 */
interface AppActionEvent extends AppEvent {
  kind: typeof appActionsTopic;
  appAction: AppAction;
}

/**
 * Factory of AppActionEvent
 * @param op operation of the event
 * @param appAction value of the app action for this event
 * @returns instance of app action event
 */
export const AppActionEvent = (op: AppActionEvent['op'], appAction: AppAction): AppActionEvent => ({
  kind: appActionsTopic,
  op,
  appAction,
});

/**
 * Events that affect an app setting
 */
interface AppSettingEvent extends AppEvent {
  kind: typeof appSettingsTopic;
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
  kind: appSettingsTopic,
  op,
  appSetting,
});
