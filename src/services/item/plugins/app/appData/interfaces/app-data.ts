import { AppDataVisibility, UUID } from '@graasp/sdk';

export type InputAppData = {
  id?: UUID;
  data: Record<string, unknown>;
  type: string;
  visibility: AppDataVisibility;
  memberId?: string;
};
