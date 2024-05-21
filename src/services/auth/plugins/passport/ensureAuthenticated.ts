import { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

export const ensureAuthenticated: RouteHandlerMethod = async (
  request: FastifyRequest,
  _reply: FastifyReply,
) => {
  return request.passport ? undefined : new Error('Unauthorized');
};
