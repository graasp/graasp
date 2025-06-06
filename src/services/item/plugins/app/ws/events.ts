import type { AppActionRaw, AppDataRaw, AppSettingRaw } from '../../../../../drizzle/types';

// changes on app entities
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
  appData: AppDataRaw;
}

/**
 * Factory of AppDataEvent
 * @param op operation of the event
 * @param appData value of the appData for this event
 * @returns instance of app data event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AppDataEvent = (op: AppDataEvent['op'], appData: AppDataRaw): AppDataEvent => ({
  kind: appDataTopic,
  op,
  appData,
});

/**
 * Events that affect an app action
 */
interface AppActionEvent extends AppEvent {
  kind: typeof appActionsTopic;
  appAction: AppActionRaw;
}

/**
 * Factory of AppActionEvent
 * @param op operation of the event
 * @param appAction value of the app action for this event
 * @returns instance of app action event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AppActionEvent = (
  op: AppActionEvent['op'],
  appAction: AppActionRaw,
): AppActionEvent => ({
  kind: appActionsTopic,
  op,
  appAction,
});

/**
 * Events that affect an app setting
 */
interface AppSettingEvent extends AppEvent {
  kind: typeof appSettingsTopic;
  appSetting: AppSettingRaw;
}

/**
 * Factory of AppSettingEvent
 * @param op operation of the event
 * @param appAction value of the app setting for this event
 * @returns instance of app setting event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AppSettingEvent = (
  op: AppSettingEvent['op'],
  appSetting: AppSettingRaw,
): AppSettingEvent => ({
  kind: appSettingsTopic,
  op,
  appSetting,
});
