import { UUID } from '@graasp/sdk';

export type InputAppSetting = {
  name: string;
  itemId: string;
  data: Record<string, unknown>;
  id: UUID;
};
