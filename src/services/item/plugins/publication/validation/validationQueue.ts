import { hoursToSeconds } from 'date-fns';
import { Redis } from 'ioredis';
import { singleton } from 'tsyringe';

import { getChildFromPath, getIdsFromPath } from '@graasp/sdk';

import { ItemValidationAlreadyExist } from './errors';

const EXPIRES_IN_SECONDS = hoursToSeconds(2);
const REDIS_PROGRESS_VALIDATION_KEY = 'validation_in_progress';
const REDIS_PROGRESS_VALIDATION_VALUE = 1; // we don't care the value, we just want to check if a key exists...
const buildRedisProgressKey = (itemId: string) => `${REDIS_PROGRESS_VALIDATION_KEY}:${itemId}`;

// This class allows us to track the pending validations.
// At some point, we would like to use a real Queue with Redis for example.
@singleton()
export class ValidationQueue {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Checks if a validation is in progress for the given item path or any of its parent items.
   * @param itemPath The path of the item to check. For example: "parentItemId/childItemId/grandChildItemId".
   * @returns True if a validation is in progress, false otherwise.
   */
  public async isInProgress(itemPath: string) {
    // Extract all item IDs from the path (parent, child, grand-child, etc.).
    const itemIds = getIdsFromPath(itemPath);

    if (itemIds.length === 0) {
      throw new Error(`The given item path ${itemPath} is invalid!`);
    }

    const keys = itemIds.map((i) => buildRedisProgressKey(i));
    // Attempt to retrieve validation status for all IDs in the path from Redis.
    // mget returns an array of values or null if the key doesn't exist.
    const values = (await this.redis.mget(keys)).filter((v): v is string => Boolean(v));

    // If any of the IDs in the path have a validation in progress, return true.
    return values.length > 0;
  }

  /**
   * Store the validation progress to retrieve the pending state outside of the transaction.
   * Only stores the validation status for the root item ID in the path.
   * This allows to easily check if a child's parent is already in validation.
   * @param itemPath The path of the item to validate.
   * @param expiresInSeconds The number of seconds after what the validation is removed.
   */
  public async addInProgress(itemPath: string, expiresInSeconds = EXPIRES_IN_SECONDS) {
    if (expiresInSeconds < 0) {
      throw new Error('The expire time must be a positive value!');
    }

    const isInProgress = await this.isInProgress(itemPath);
    if (isInProgress) {
      throw new ItemValidationAlreadyExist(getChildFromPath(itemPath));
    }

    // Only the root itemId is used to track validation progress.
    const itemId = getChildFromPath(itemPath);

    // Set the validation status for the root itemId in Redis.
    await this.redis.set(buildRedisProgressKey(itemId), REDIS_PROGRESS_VALIDATION_VALUE);
    await this.redis.expire(buildRedisProgressKey(itemId), expiresInSeconds);
  }

  /**
   * Removes the validation progress for the given item path (specifically, its root item ID).
   * @param itemPath The path of the item to remove the validation status for.
   */
  public async removeInProgress(itemPath: string) {
    const itemId = getChildFromPath(itemPath);
    await this.redis.del(buildRedisProgressKey(itemId));
  }
}
