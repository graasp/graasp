import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
export declare class GetMembersByTask extends BaseMemberTask {
    get name(): string;
    constructor(actor: Actor, data: Partial<Member>, memberService: MemberService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
