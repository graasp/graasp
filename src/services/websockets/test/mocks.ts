/**
 * graasp-plugin-websockets
 *
 * Mock instances for testing in graasp-plugin-websockets
 */
import { FastifyReply, FastifyRequest } from 'fastify';

import { MemberFactory } from '@graasp/sdk';

// mock preHandler to be injected in test fastify instance to simulate authentication
export const mockSessionPreHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
  request.user = { account: MemberFactory() };
};

// Signature of @types/graasp/plugins/auth/interfaces/auth.d.ts is wrong! Force return of Promise
// instead of void to ensure termination (https://www.fastify.io/docs/latest/Hooks/#prehandler).
export const mockValidateSession = jest.fn().mockReturnValue(Promise.resolve());
