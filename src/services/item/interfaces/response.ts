export class Paginated<T> {
  data: T[];
  totalCount: number;
}

export type PaginationArgs = {
  page: number;
  limit: number;
};
