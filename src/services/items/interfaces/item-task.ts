// global
import { Task } from 'interfaces/task';
// other services
import { Member } from 'services/members/interfaces/member';
// local
import { Item } from './item';

export interface ItemTask extends Task<Member, Item> {
  parentItemId?: string;
}
