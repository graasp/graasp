import type { MinimalAccount } from '../../../../drizzle/types';

/**
 * Add legacy property `member` to an app data
 * @param appData
 * @returns appData with an additional key `member`
 */
export const addMemberInAppData = <T extends { account: MinimalAccount }>(ad: T) => ({
  member: ad.account,
  ...ad,
});

/**
 * Add legacy property `member` to an app action
 * @param appAction
 * @returns appData with an additional key `member`
 */
export const addMemberInAppAction = <T extends { account: MinimalAccount }>(aa: T) => ({
  member: aa.account,
  ...aa,
});
