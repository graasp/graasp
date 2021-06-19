declare module 'fastify' {
  interface FastifyRequest {
    /** member id extracted from auth token when auth is token based (app) */
    memberId: string;
  }
  interface FastifyInstance {
    /**
     * Verify authentication based on session cookie or auth token,
     * extract member from it, and set `request.member`.
     * Throws exception if it fails.
     */
    verifyAuthentication: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    /**
     * Validate session, extract member from it, and set `request.member`.
     * Throws exception if it fails.
     */
    validateSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    /**
     * Tries to verify authentication based on session cookie or auth token,
     * extract member from it, and set `request.member`.
     * Does not fail/throw - simply does not set `request.member`.
     */
    attemptVerifyAuthentication: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    /**
     * Generate auth+refresh tokens pair for token base auth
     */
    generateAuthTokensPair: (memberId: string) => Promise<{ authToken: string, refreshToken: string }>;
  }
}

export interface AuthPluginOptions {
  sessionCookieDomain: string;
  uniqueViolationErrorName?: string;
}