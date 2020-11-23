import { DatabasePoolType, DatabaseTransactionConnectionType } from 'slonik';
import { FastifyPluginAsync } from 'fastify';
export declare type DatabasePoolHandler = DatabasePoolType;
export declare type DatabaseTransactionHandler = DatabaseTransactionConnectionType;
declare module 'fastify' {
    interface FastifyInstance {
        db: Database;
    }
}
export interface Database {
    pool: DatabasePoolHandler;
}
interface DatabasePluginOptions {
    uri: string;
    logs: string;
}
declare const plugin: FastifyPluginAsync<DatabasePluginOptions>;
export default plugin;
