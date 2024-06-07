import { ItemGeolocation, ItemType, PermissionLevel, UnionOfConst } from '@graasp/sdk';

import { Member } from '../member/entities/member';

export enum SortBy {
  ItemType = 'item.type',
  ItemUpdatedAt = 'item.updated_at',
  ItemCreatedAt = 'item.created_at',
  ItemCreatorName = 'item.creator.name',
  ItemName = 'item.name',
  Rank = 'rank',
}

export enum Ordering {
  asc = 'asc',
  desc = 'desc',
  ASC = 'ASC',
  DESC = 'DESC',
}

export type AccessibleItemSearchParams = {
  creatorId?: Member['id'];
  name?: string;
  sortBy?: SortBy;
  ordering?: Ordering;
  permissions?: PermissionLevel[];
  types?: UnionOfConst<typeof ItemType>[];
};

export type ItemSearchParams = {
  creatorId?: Member['id'];
  keywords?: string[];
  sortBy?: SortBy;
  ordering?: Ordering;
  permissions?: PermissionLevel[];
  types?: UnionOfConst<typeof ItemType>[];
  geolocationBounds?: {
    lat1?: ItemGeolocation['lat'];
    lat2?: ItemGeolocation['lat'];
    lng1?: ItemGeolocation['lng'];
    lng2?: ItemGeolocation['lng'];
  };
};

export type ItemChildrenParams = {
  ordered?: boolean;
  keywords?: string[];
  types?: UnionOfConst<typeof ItemType>[];
};
