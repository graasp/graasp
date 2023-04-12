import { Anything, UUID } from '@graasp/sdk';

import { AppDataVisibility } from '../../interfaces/app-details';

export interface InputAppData {
  id?: UUID;
  data: { [key: string]: Anything };
  type: string;
  visibility: AppDataVisibility;
  memberId?: string;
}
