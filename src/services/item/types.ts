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
  creatorId?: Member['id'];
  keywords?: string[];
  sortBy?: SortBy;
  ordering?: Ordering;
  permissions?: PermissionLevel[];
  types?: UnionOfConst<typeof ItemType>[];
};

export type ItemChildrenParams = {
  ordered?: boolean;
  types?: UnionOfConst<typeof ItemType>[];
  keywords?: string[];
};
