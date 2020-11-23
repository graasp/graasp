/// <reference types="node" />
import { FastifyPluginAsync } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        validateSession: any;
    }
}
declare const _default: FastifyPluginAsync<Record<never, never>, import("http").Server>;
export default _default;
