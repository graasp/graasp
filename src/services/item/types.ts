import { Member } from '../member/entities/member';

export type SortBy = 'type' | 'updated_at' | 'created_at' | 'creator.name' | 'name';
export type Ordering = 'asc' | 'desc' | 'ASC' | 'DESC';

export type ItemSearchParams = {
  creatorId?: Member['id'];
  name?: string;
  sortBy?: SortBy;
  ordering?: Ordering;
};
