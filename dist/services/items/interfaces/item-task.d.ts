import { Task } from '../../../interfaces/task';
import { Member } from '../../../services/members/interfaces/member';
import { Item } from './item';
export interface ItemTask extends Task<Member, Item> {
    parentItemId?: string;
}
