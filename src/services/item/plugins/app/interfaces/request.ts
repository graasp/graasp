import { AppDataVisibility } from '@graasp/sdk';

export interface SingleItemGetFilter {
  accountId?: string;
  visibility?: AppDataVisibility;
}

export interface ManyItemsGetFilter extends SingleItemGetFilter {
  itemId: string[];
}
