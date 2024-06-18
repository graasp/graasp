import { AppDataVisibility } from '@graasp/sdk';

export type SingleItemGetFilter = {
  memberId?: string;
  visibility?: AppDataVisibility;
};

export type ManyItemsGetFilter = {
  itemId: string[];
} & SingleItemGetFilter;
