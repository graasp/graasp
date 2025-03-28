import { FastifyPluginAsync } from 'fastify';

import { Websocket } from '@graasp/sdk';

import { WebsocketService } from '../../websockets/ws-service';
import { memberItemsTopic } from './item.events';

/**
 * helper to register items of member topic
 */
function registerMemberItemsTopic(websockets: WebsocketService) {
  websockets.register(memberItemsTopic, async (req) => {
    const { channel: memberId, member } = req;
    // requeted memberId channel must be current member
    if (memberId !== member?.id) {
      throw new Websocket.AccessDeniedError();
    }
  });
}

/**
 * Registers real-time websocket events for the item service
 */
export const itemWsHooks: FastifyPluginAsync = async (fastify) => {
  const { websockets } = fastify;
  registerMemberItemsTopic(websockets);
};
