import { AppDataVisibility } from './app-details';

export interface SingleItemGetFilter {
  memberId?: string;
  visibility?: AppDataVisibility;
}

export interface ManyItemsGetFilter extends SingleItemGetFilter {
  itemId: string[];
}
