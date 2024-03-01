import { ItemType, PermissionLevel, UnionOfConst } from '@graasp/sdk';

import { Member } from '../member/entities/member';

export enum SortBy {
  ItemType = 'item.type',
  ItemUpdatedAt = 'item.updated_at',
  ItemCreatedAt = 'item.created_at',
  ItemCreatorName = 'item.creator.name',
  ItemName = 'item.name',
}

export enum Ordering {
  asc = 'asc',
  desc = 'desc',
  ASC = 'ASC',
  DESC = 'DESC',
}

export type ItemSearchParams = {
  creatorId?: Member['id'];
  name?: string;
  sortBy?: SortBy;
  ordering?: Ordering;
  permissions?: PermissionLevel[];
  types?: UnionOfConst<typeof ItemType>[];
};

export type ItemChildrenParams = {
  ordered?: boolean;
  types?: UnionOfConst<typeof ItemType>[];
};

export type PromiseRunnerResults<T> = {
  success: T[];
  failed: Error[];
};

export class PromiseRunner {
  private static transformPromiseResults = <T>(results: PromiseSettledResult<T>[]) => {
    const success = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<T>).value);

    const failed = results
      .filter((result) => result.status === 'rejected')
      .map((result) => new Error((result as PromiseRejectedResult).reason));

    return { success, failed };
  };

  public static async inSeries<T>(
    promises: (() => Promise<T>)[],
  ): Promise<PromiseRunnerResults<T>> {
    const success: PromiseRunnerResults<T>['success'] = [];
    const failed: PromiseRunnerResults<T>['failed'] = [];

    const startTime = performance.now();

    for (const promise of promises) {
      try {
        const result = await promise();
        success.push(result);
      } catch (error) {
        failed.push(error);
      }
    }

    const endTime = performance.now();
    console.log(
      `Series terminated after ${endTime - startTime} ms for ${promises.length} Promises`,
      startTime,
      endTime,
    );

    return { success, failed };
  }

  public static async allSettled<T>(
    promises: (() => Promise<T>)[],
  ): Promise<PromiseRunnerResults<T>> {
    const startTime = performance.now();

    const results = await Promise.allSettled(promises.map((promise) => promise()));
    const { success, failed } = PromiseRunner.transformPromiseResults(results);

    const endTime = performance.now();
    console.log(
      `Concurrently terminated after ${endTime - startTime} ms for ${promises.length} Promises`,
      startTime,
      endTime,
    );

    return { success, failed };
  }
}
