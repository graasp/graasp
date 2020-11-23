declare enum Environment {
    production = "production",
    staging = "staging",
    development = "development"
}
export declare let ENVIRONMENT: Environment;
export declare const PROTOCOL: string;
export declare const HOSTNAME: string;
export declare const EMAIL_LINKS_HOST: string;
export declare const PORT: string;
export declare const HOST: string;
export declare const PG_CONNECTION_URI: string, DATABASE_LOGS: string, DISABLE_LOGS: string;
export declare const MAILER_CONFIG_SMTP_HOST: string;
export declare const MAILER_CONFIG_USERNAME: string;
export declare const MAILER_CONFIG_PASSWORD: string;
export declare const MAILER_CONFIG_FROM_EMAIL = "no-reply@graasp.org";
/**
 * Graasp's "internal" actor
 */
export declare const GRAASP_ACTOR: {
    id: string;
};
/**
 * JWT secret
 */
export declare const JWT_SECRET: string;
/**
 * Register (JWT) token expiration, in minutes
 */
export declare const REGISTER_TOKEN_EXPIRATION_IN_MINUTES = 60;
/**
 * Login (JWT) token expiration, in minutes
 */
export declare const LOGIN_TOKEN_EXPIRATION_IN_MINUTES = 30;
/**
 * Maximun items tree depth
 */
export declare const MAX_TREE_LEVELS = 15;
/**
 * Maximun number of children an item can have
 */
export declare const MAX_NUMBER_OF_CHILDREN = 10;
/**
 * Maximun number of descendants (in the item's subtree) for a `delete`
 */
export declare const MAX_DESCENDANTS_FOR_DELETE = 5;
/**
 * Maximun number of descendants (in the item's subtree) for a `update`
 */
export declare const MAX_DESCENDANTS_FOR_UPDATE = 5;
/**
 * Maximun number of descendants (in the item's subtree) for a `move`
 */
export declare const MAX_DESCENDANTS_FOR_MOVE = 15;
/**
 * Maximun number of descendants (in the item's subtree) for a `copy`
 */
export declare const MAX_DESCENDANTS_FOR_COPY = 20;
/**
 * Maximun number of targets in a "many" request that only reads data (`get`)
 */
export declare const MAX_TARGETS_FOR_READ_REQUEST = 100;
/**
 * Maximun number of targets in a "many" request that modifies data (`update`, `delete`)
 */
export declare const MAX_TARGETS_FOR_MODIFY_REQUEST = 20;
/**
 * Maximun number of targets in a "many" request for which the server
 * will execute the tasks and return the results in the same request's response.
 *
 * A request with more targets than this limit should get an immediate `202` response,
 * and the results should be pushed to the client (websockets, ...) as they happen.
 */
export declare const MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE = 5;
export declare const FILE_STORAGE_ROOT_PATH: string;
export {};
