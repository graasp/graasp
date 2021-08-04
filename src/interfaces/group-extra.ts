import { UnknownExtra } from './extra';

export interface GroupExtra extends UnknownExtra {
  creator?: { memberId: string },
  rootFolder: { itemId: string }
}
