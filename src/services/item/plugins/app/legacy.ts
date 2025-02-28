import { Account } from '../../../../drizzle/schema';

/**
 * Add legacy property `member` to an app data
 * @param appData
 * @returns appData with an additional key `member`
 */
export const addMemberInAppData = <T extends { account: Account }>(ad: T) => ({
  member: ad.account,
  ...ad,
});

/**
 * Add legacy property `member` to an app action
 * @param appAction
 * @returns appData with an additional key `member`
 */
export const addMemberInAppAction = <T extends { account: Account }>(aa: T) => ({
  member: aa.account,
  ...aa,
});
