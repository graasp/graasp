import { FastifyBaseLogger } from 'fastify';

import { getParentFromPath } from '@graasp/sdk';

import { WebsocketService } from '../../websockets/ws-service';
import { Item } from '../entities/Item';
import { getPromiseResults } from '../utils';
import {
  AccessibleItemsEvent,
  ChildItemEvent,
  ItemOpFeedbackEvent,
  OwnItemsEvent,
  itemTopic,
  memberItemsTopic,
} from './events';

// on move item:
// - notify own items of creator of delete IF old location was root
// - notify own items of creator of create IF new location is root
const publishMemberItemsTopic = (
  websockets: WebsocketService,
  { source, destination, sourceParentId },
) => {
  if (sourceParentId === undefined && source.creator) {
    // root item, notify creator
    // todo: remove own when we don't use own anymore
    websockets.publish(memberItemsTopic, source.creator.id, OwnItemsEvent('delete', source));
    websockets.publish(memberItemsTopic, source.creator.id, AccessibleItemsEvent('delete', source));
  }

  const destParentId = getParentFromPath(destination.path);
  if (destParentId === undefined && destination.creator) {
    // root item, notify creator
    // todo: remove own when we don't use own anymore
    websockets.publish(
      memberItemsTopic,
      destination.creator.id,
      OwnItemsEvent('create', destination),
    );
    websockets.publish(
      memberItemsTopic,
      destination.creator.id,
      AccessibleItemsEvent('create', destination),
    );
  }
};

// on move item, notify:
// - parent of old location of deleted child
// - parent of new location of new child
const publishItemTopic = (
  websockets: WebsocketService,
  { source, destination, sourceParentId },
) => {
  if (sourceParentId !== undefined) {
    websockets.publish(itemTopic, sourceParentId, ChildItemEvent('delete', source));
  }

  const destParentId = getParentFromPath(destination.path);
  if (destParentId) {
    websockets.publish(itemTopic, destParentId, ChildItemEvent('create', destination));
  }
};

export const publishAfterMoved = (
  websockets: WebsocketService,
  { source, destination, sourceParentId },
) => {
  publishItemTopic(websockets, { source, destination, sourceParentId });
  publishMemberItemsTopic(websockets, { source, destination, sourceParentId });
};

// TODO: update this to send only one ws ? like a warning or success or error ?
export const publishFeedbackAfterAllMoved = ({
  websockets,
  results,
  itemIds,
  log,
  memberId,
}: {
  websockets: WebsocketService;
  results: PromiseSettledResult<Item>[];
  itemIds: string[];
  log: FastifyBaseLogger;
  memberId: string;
}) => {
  const { success, failed } = getPromiseResults(results);
  const successIds = success.map((i) => i.id);
  const failedIds = itemIds.filter((id) => !successIds.includes(id));

  if (success.length) {
    websockets.publish(
      memberItemsTopic,
      memberId,
      ItemOpFeedbackEvent(
        'move',
        success.map((i) => i.id),
        {
          data: Object.fromEntries(success.map((i) => [i.id, i])),
          errors: [],
        },
      ),
    );
  }
  if (failed.length) {
    failed.forEach((e) => {
      log.error(e);
      websockets.publish(
        memberItemsTopic,
        memberId,
        ItemOpFeedbackEvent('move', failedIds, { error: e }),
      );
    });
  }
};
