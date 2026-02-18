import { Data, WebSocket } from 'ws';

import { FastifyBaseLogger } from 'fastify';

import { Websocket as GraaspWS } from '@graasp/sdk';

import { Account } from '../account/entities/account';
import { Actor } from '../member/entities/member';
import {
  createServerErrorResponse,
  createServerSuccessResponse,
  createServerUpdate,
} from './message';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';

export interface SubscriptionRequest {
  /**
   * Subscription target channel name
   */
  channel: string;
  /**
   * Member requesting a subscription
   */
  member: Account;
}

type ValidationFn = (request: SubscriptionRequest) => Promise<void>;

/**
 * Concrete implementation of the WebSocket service
 * Provides WebSocket connectivity to the rest of the server
 * @see {WebSocketService}
 */
export class WebsocketService {
  // store for validation functions indexed by topic
  private validators: Map<string, ValidationFn> = new Map();
  // channels abstraction reference
  private wsChannels: WebSocketChannels;
  // multi-instance channels broker reference (to send across servers cluster)
  private wsMultiBroker: MultiInstanceChannelsBroker;
  // parser function that converts raw client websocket data into JS
  private parse: (data: Data) => GraaspWS.ClientMessage | undefined;
  // logger
  private logger: FastifyBaseLogger;

  constructor(
    wsChannels: WebSocketChannels,
    wsMultiBroker: MultiInstanceChannelsBroker,
    parse: (data: Data) => GraaspWS.ClientMessage | undefined,
    log: FastifyBaseLogger,
  ) {
    this.wsChannels = wsChannels;
    this.wsMultiBroker = wsMultiBroker;
    this.parse = parse;
    this.logger = log;
  }

  /**
   * Helper to scope channel by topic
   * @param channel public channel name
   * @param topic topic into which the channel should be scoped
   * @returns low-level unique channel name that includes scoping information
   */
  private scope(channel: string, topic: string): string {
    if (channel === 'broadcast') {
      return channel;
    }
    return `${topic}/${channel}`;
  }

  /**
   * Helper to handle client subscribe and subscribeOnly actions
   */
  private async handleSubscribe(
    request: GraaspWS.ClientSubscribe | GraaspWS.ClientSubscribeOnly,
    member: Actor,
    client: WebSocket,
    subscribeFn: (client: WebSocket, channelName: string) => boolean,
  ) {
    let res: GraaspWS.ServerMessage;

    // prevent public subscribe
    if (!member) {
      res = createServerErrorResponse(
        { message: 'not authorized', name: 'websockets signed out' },
        request,
      );
      return this.wsChannels.clientSend(client, res);
    }

    const validate = this.validators.get(request.topic);
    if (validate === undefined) {
      this.logger.info(`graasp-plugin-websockets: Validator not found for topic ${request.topic}`);
      res = createServerErrorResponse(new GraaspWS.NotFoundError(), request);
    } else {
      try {
        await validate({
          channel: request.channel,
          member,
        });

        // scope channel into topic
        const scopedChannel = this.scope(request.channel, request.topic);

        // no throw so user is allowed, create channel if needed
        if (!this.wsChannels.channels.has(scopedChannel)) {
          this.wsChannels.channelCreate(scopedChannel, true);
        }

        res = subscribeFn(client, scopedChannel)
          ? createServerSuccessResponse(request)
          : createServerErrorResponse(new GraaspWS.NotFoundError(), request);
      } catch (error) {
        res = createServerErrorResponse(error as Error, request);
      }
    }

    this.wsChannels.clientSend(client, res);
  }

  /**
   * Helper to handle unsubscribe action
   */
  private handleUnsubscribe(request: GraaspWS.ClientUnsubscribe, client: WebSocket) {
    // scope channel into topic
    const scopedChannel = this.scope(request.channel, request.topic);
    const res = this.wsChannels.clientUnsubscribe(client, scopedChannel)
      ? createServerSuccessResponse(request)
      : createServerErrorResponse(new GraaspWS.NotFoundError(), request);
    this.wsChannels.clientSend(client, res);
    // preemptively remove channel if empty
    this.wsChannels.channelDelete(scopedChannel, true);
  }

  /**
   * Handles incoming client websocket requests according to the
   * Graasp WebSocket protocol
   * @param data raw websocket data sent from client
   * @param member member performing the request
   * @param socket client socket
   */
  handleRequest(data: Data, member: Actor, client: WebSocket): void {
    const request = this.parse(typeof data === 'string' ? data : data?.toString());

    // validation error, send bad request
    if (request === undefined) {
      this.logger.info(
        `graasp-plugin-websockets: Bad client request (memberID: ${member?.id}) with message: ${data?.toString()}`,
      );
      const err = new GraaspWS.BadRequestError();
      this.wsChannels.clientSend(client, createServerErrorResponse(err));
      return;
    }

    // request is now type-safe as ClientMessage
    switch (request.action) {
      case GraaspWS.ClientActions.Disconnect: {
        this.wsChannels.clientRemove(client);
        break;
      }
      case GraaspWS.ClientActions.Subscribe: {
        this.handleSubscribe(request, member, client, (client, channel) =>
          this.wsChannels.clientSubscribe(client, channel),
        );
        break;
      }
      case GraaspWS.ClientActions.SubscribeOnly: {
        this.handleSubscribe(request, member, client, (client, channel) =>
          this.wsChannels.clientSubscribeOnly(client, channel),
        );
        break;
      }
      case GraaspWS.ClientActions.Unsubscribe: {
        this.handleUnsubscribe(request, client);
        break;
      }
    }
  }

  register(topic: string, validateClient: ValidationFn): this {
    if (this.validators.has(topic)) {
      this.logger.error(`graasp-plugin-websockets: Topic ${topic} is already registered`);
      throw new Error('WebSocketService.register: topic already exists!');
    }
    this.validators.set(topic, validateClient);
    return this;
  }

  publish<Message>(topic: string, channel: string, message: Message): void {
    // scope channel into topic
    const scopedChannel = this.scope(channel, topic);
    this.wsMultiBroker.dispatch(scopedChannel, createServerUpdate(topic, channel, message));
  }

  publishLocal<Message>(topic: string, channel: string, message: Message): void {
    // scope channel into topic
    const scopedChannel = this.scope(channel, topic);
    this.wsChannels.channelSend(scopedChannel, createServerUpdate(topic, channel, message));
  }
}
