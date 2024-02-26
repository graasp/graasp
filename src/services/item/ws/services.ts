import { FastifyBaseLogger } from 'fastify';

import { getParentFromPath } from '@graasp/sdk';

import { WebsocketService } from '../../websockets/ws-service';
import { Item } from '../entities/Item';
import { SeriesPromiseResults } from '../types';
import {
  AccessibleItemsEvent,
  ChildItemEvent,
  ItemOpFeedbackEvent,
  ItemOpFeedbackEventInterface,
  OwnItemsEvent,
  itemTopic,
  memberItemsTopic,
} from './events';

type MoveParams = {
  source: Item;
  destination: Item;
  sourceParentId?: string;
};

export class ItemWebsocketsService {
  private websockets;

  constructor(websockets: WebsocketService) {
    this.websockets = websockets;
  }

  // TODO: update this to send only one ws ? like a warning or success or error ?
  private publishFeedback({
    results,
    itemIds,
    log,
    memberId,
    feedbackOp,
  }: {
    results: SeriesPromiseResults<Item>;
    itemIds: string[];
    log: FastifyBaseLogger;
    memberId: string;
    feedbackOp: ItemOpFeedbackEventInterface['op'];
  }) {
    const { success, failed } = results;
    const successIds = success.map((i) => i.id);
    const failedIds = itemIds.filter((id) => !successIds.includes(id));

    if (success.length) {
      this.websockets.publish(
        memberItemsTopic,
        memberId,
        ItemOpFeedbackEvent(feedbackOp, successIds, {
          data: Object.fromEntries(success.map((i) => [i.id, i])),
          errors: [],
        }),
      );
    }
    if (failed.length) {
      failed.forEach((e) => {
        log.error(e);
        this.websockets.publish(
          memberItemsTopic,
          memberId,
          ItemOpFeedbackEvent(feedbackOp, failedIds, { error: e }),
        );
      });
    }
  }

  public publishTopicsForMove({ source, destination, sourceParentId }: MoveParams) {
    const destParentId = getParentFromPath(destination.path);

    // on move item:
    // - notify own items of creator of delete IF old location was root
    // - notify own items of creator of create IF new location is root
    if (sourceParentId === undefined && source.creator) {
      // root item, notify creator
      // todo: remove own when we don't use own anymore
      this.websockets.publish(memberItemsTopic, source.creator.id, OwnItemsEvent('delete', source));
      this.websockets.publish(
        memberItemsTopic,
        source.creator.id,
        AccessibleItemsEvent('delete', source),
      );
    }
    if (destParentId === undefined && destination.creator) {
      // root item, notify creator
      // todo: remove own when we don't use own anymore
      this.websockets.publish(
        memberItemsTopic,
        destination.creator.id,
        OwnItemsEvent('create', destination),
      );
      this.websockets.publish(
        memberItemsTopic,
        destination.creator.id,
        AccessibleItemsEvent('create', destination),
      );
    }

    // on move item, notify:
    // - parent of old location of deleted child
    // - parent of new location of new child
    if (sourceParentId !== undefined) {
      this.websockets.publish(itemTopic, sourceParentId, ChildItemEvent('delete', source));
    }
    if (destParentId) {
      this.websockets.publish(itemTopic, destParentId, ChildItemEvent('create', destination));
    }
  }

  public publishFeedbacksForMove({
    results,
    itemIds,
    log,
    memberId,
  }: {
    results: SeriesPromiseResults<Item>;
    itemIds: string[];
    log: FastifyBaseLogger;
    memberId: string;
  }) {
    this.publishFeedback({
      results,
      itemIds,
      log,
      memberId,
      feedbackOp: 'move',
    });
  }
}
