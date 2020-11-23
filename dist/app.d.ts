/// <reference types="node" />
import { ItemService } from './services/items/db-service';
import { ItemMembershipService } from './services/item-memberships/db-service';
import { MemberService } from './services/members/db-service';
import { Member } from './services/members/interfaces/member';
declare module 'fastify' {
    interface FastifyInstance {
        memberService: MemberService;
        itemService: ItemService;
        itemMembershipService: ItemMembershipService;
    }
    interface FastifyRequest {
        member: Member;
    }
}
declare const instance: import("fastify").FastifyInstance<import("http").Server, import("http").IncomingMessage, import("http").ServerResponse, import("fastify").FastifyLoggerInstance> & PromiseLike<import("fastify").FastifyInstance<import("http").Server, import("http").IncomingMessage, import("http").ServerResponse, import("fastify").FastifyLoggerInstance>>;
export default instance;
