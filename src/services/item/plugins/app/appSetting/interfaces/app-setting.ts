import { Anything, UUID } from '@graasp/sdk';

export interface InputAppSetting {
  name: string;
  itemId: string;
  data: { [key: string]: Anything };
  id: UUID;
}
