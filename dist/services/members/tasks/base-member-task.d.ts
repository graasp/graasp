import { GraaspError } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { TaskStatus } from '../../../interfaces/task';
import { Task } from '../../../interfaces/task';
import { Actor } from '../../../interfaces/actor';
import { Member } from '../interfaces/member';
import { MemberService } from '../db-service';
export declare abstract class BaseMemberTask implements Task<Actor, Member> {
    protected memberService: MemberService;
    protected _status: TaskStatus;
    protected _result: Member | Member[];
    protected _message: string;
    readonly actor: Actor;
    targetId: string;
    data: Partial<Member>;
    constructor(actor: Actor, memberService: MemberService);
    abstract get name(): string;
    get status(): TaskStatus;
    get result(): Member | Member[];
    get message(): string;
    protected failWith(error: GraaspError): void;
    abstract run(handler: DatabaseTransactionHandler): Promise<void | BaseMemberTask[]>;
}
