import { AppDataVisibility, UUID } from '@graasp/sdk';

export interface InputAppData {
  id?: UUID;
  data: { [key: string]: unknown };
  type: string;
  visibility: AppDataVisibility;
  memberId?: string;
}
