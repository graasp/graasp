import { AppDataVisibility, UUID } from '@graasp/sdk';

export interface InputAppData {
  id?: UUID;
  data: { [key: string]: unknown };
  type: string;
  visibility: AppDataVisibility;
  accountId?: string;
  /**
   * @deprecated use accountId - legacy to work with old apps
   */
  memberId?: string;
}
