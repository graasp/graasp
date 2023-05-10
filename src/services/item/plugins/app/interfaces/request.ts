import { AppDataVisibility } from '@graasp/sdk';

export interface SingleItemGetFilter {
  memberId?: string;
  visibility?: AppDataVisibility;
}

export interface ManyItemsGetFilter extends SingleItemGetFilter {
  itemId: string[];
}
