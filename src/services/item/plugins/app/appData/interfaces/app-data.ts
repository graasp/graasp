import { Anything, AppDataVisibility, UUID } from '@graasp/sdk';

export interface InputAppData {
  id?: UUID;
  data: { [key: string]: Anything };
  type: string;
  visibility: AppDataVisibility;
  memberId?: string;
}
