import {GroupMembership} from './interfaces/group-membership';

export class BaseGroupMembership implements GroupMembership {
  readonly id: string;
  readonly member: string;
  readonly group: string;

  constructor(member: string,group: string) {
    this.member = member;
    this.group = group;
  }
}
