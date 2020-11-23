import { DatabaseTransactionHandler } from '../../../plugins/database';
import { Actor } from '../../../interfaces/actor';
import { MemberService } from '../db-service';
import { BaseMemberTask } from './base-member-task';
export declare class GetMemberTask extends BaseMemberTask {
    get name(): string;
    constructor(actor: Actor, memberId: string, memberService: MemberService);
    run(handler: DatabaseTransactionHandler): Promise<void>;
}
