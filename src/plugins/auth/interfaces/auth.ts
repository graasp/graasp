declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Validate session, extract member from it, and set `request.member`.
     * Throws exception if it fails.
     */
    validateSession: (request: FastifyRequest, reply: FastifyReply) => void;
    /**
     * Tries to validate session and extract member from it.
     * Does not fail/throw - simply does not set `request.member`.
     */
    fetchSession: (request: FastifyRequest) => void;
  }
}

export interface AuthPluginOptions {
  sessionCookieDomain: string;
  uniqueViolationErrorName?: string;
}