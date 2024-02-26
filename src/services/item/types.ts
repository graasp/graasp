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

export type SeriesPromiseResults<T> = {
  success: T[];
  failed: Error[];
};

export class SeriesPromise {
  public static async allSettled<T>(
    promises: (() => Promise<T>)[],
  ): Promise<SeriesPromiseResults<T>> {
    const success: SeriesPromiseResults<T>['success'] = [];
    const failed: SeriesPromiseResults<T>['failed'] = [];

    for (const promise of promises) {
      try {
        const result = await promise();
        success.push(result);
      } catch (error) {
        failed.push(error);
      }
    }

    return { success, failed };
  }
}
