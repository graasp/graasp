import { Member } from '../member/entities/member';

export enum SortBy {
  Type = 'type',
  UpdatedAt = 'updated_at',
  CreatedAt = 'created_at',
  CreatorName = 'creator.name',
  Name = 'name',
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
