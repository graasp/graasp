import { AppAction } from './appAction/appAction';
import { AppData } from './appData/appData';

/**
 * Add legacy property `member` to an app data
 * @param appData
 * @returns appData with an additional key `member`
 */
export const addMemberInAppData = (ad: AppData) => ({
  member: ad.account,
  ...ad,
});

/**
 * Add legacy property `member` to an app action
 * @param appAction
 * @returns appData with an additional key `member`
 */
export const addMemberInAppAction = (aa: AppAction) => ({
  member: aa.account,
  ...aa,
});
