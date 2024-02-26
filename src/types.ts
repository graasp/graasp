export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export class Paginated<T> {
  data: T[];
  totalCount: number;
}

export type IdParam = {
  id: string;
};

export type IdsParams = {
  id: string[];
};
