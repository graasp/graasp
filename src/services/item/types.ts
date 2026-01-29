import type { MinimalAccount } from '../../drizzle/types';
import { ItemType } from '../../schemas/global';
import { PermissionLevel } from '../../types';

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

export function orderingToUpperCase(ordering: Ordering): Ordering.ASC | Ordering.DESC {
  switch (ordering) {
    case Ordering.asc:
      return Ordering.ASC;
    case Ordering.desc:
      return Ordering.DESC;
    default:
      return ordering;
  }
}

export type ItemSearchParams = {
  creatorId?: MinimalAccount['id'];
  keywords?: string[];
  sortBy?: SortBy;
  ordering?: Ordering;
  permissions?: PermissionLevel[];
  types?: ItemType[];
};

export type ItemChildrenParams = {
  types?: ItemType[];
  keywords?: string[];
};
