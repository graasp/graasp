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
};

export type ItemIdToNameMap = {
  [key: string]: string;
};
