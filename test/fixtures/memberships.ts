import { v4 as uuidv4 } from 'uuid';
import {
  ItemMembership,
  PermissionLevel,
} from '../../src/services/item-memberships/interfaces/item-membership';
import { ACTOR } from './members';

export const buildMembership = (options: {
  path?: string;
  memberId?: string;
  permission?: PermissionLevel;
  creator?: string;
}): ItemMembership => ({
  id: uuidv4(),
  memberId: options.memberId ?? ACTOR.id,
  itemPath: options.path,
  permission: options.permission ?? PermissionLevel.Read,
  creator: options.creator ?? options.memberId ?? ACTOR.id,
  createdAt: '2021-03-29T08:46:52.939Z',
  updatedAt: '2021-03-29T08:46:52.939Z',
});
