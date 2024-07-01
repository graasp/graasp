import { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

import { InsufficientPermission } from '../../error';
import { RoleStrategy } from './types';

/**
 * preHandler to check if user validate one of the preconditions to access a route.
 * @param strategies One or more role strategies to check if user validate the preconditions.
 * @throws {InsufficientPermission} If user does not validate any of the preconditions.
 * @throws {GraaspAuthError} If only one role strategy is provided and it failed with a provided error.
 */
export function whitelistRoles(...strategies: RoleStrategy[]): RouteHandlerMethod {
  return async ({ user }: FastifyRequest<{ Body: { captcha: string } }>, _reply: FastifyReply) => {
    if (!strategies.some((strategy) => strategy.test(user))) {
      // If none of the strategies pass, throw an error.
      if (strategies.length === 1 && strategies[0].error) {
        throw new strategies[0].error();
      } else {
        throw new InsufficientPermission();
      }
    }
  };
}
