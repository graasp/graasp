import { Anything } from '@graasp/sdk';

import { AppDataVisibility } from '../../interfaces/app-details';

export interface InputAppData {
  data: { [key: string]: Anything };
  type: string;
  visibility: AppDataVisibility;
  memberId?: string;
}
