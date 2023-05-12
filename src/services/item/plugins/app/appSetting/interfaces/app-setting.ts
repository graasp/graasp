import {  UUID } from '@graasp/sdk';

export interface InputAppSetting {
  name: string;
  itemId: string;
  data: { [key: string]: unknown };
  id: UUID;
}
