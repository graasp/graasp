/**
 * Item websocket events are registered under these topics
 */
import { FeedBackOperationType, ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { Item } from '../entities/Item';

type SerializedItem = Omit<Item, 'search_document'>;

// changes on items of given user
export const memberItemsTopic = 'item/member';

/**
 * All websocket events for items will have this shape
 */
export interface ItemEvent {
  kind: string;
  op: string;
  item: SerializedItem;
}

/**
 * Factory of ItemOpFeedbackEvent
 * @param op operation of the event
 * @param resource original item ids on which the operation was performed
 * @param result result of the asynchronous operation
 * @returns
 */
export const ItemOpFeedbackEvent = <T extends FeedBackOperationType>(
  op: T,
  resource: ItemOpFeedbackEventType<SerializedItem, T>['resource'],
  result: ItemOpFeedbackEventType<SerializedItem, T>['result'],
  errors?: Error[],
): ItemOpFeedbackEventType<SerializedItem, T> => ({
  kind: 'feedback',
  op,
  resource,
  result,
  // monkey patch because somehow JSON.stringify(e: Error) will always result in {}
  errors: errors ? errors.map((e) => ({ name: e.name, message: e.message })) : [],
});

/**
 * Factory of ItemOpFeedbackEvent for errors
 * @param op operation of the event
 * @param resource original item ids on which the operation was performed
 * @param error error of the asynchronous operation
 * @returns
 */
export const ItemOpFeedbackErrorEvent = <T extends FeedBackOperationType>(
  op: T,
  resource: ItemOpFeedbackEventType<SerializedItem, T>['resource'],
  error: Error,
): ItemOpFeedbackEventType<SerializedItem, T> => ({
  kind: 'feedback',
  op,
  resource,
  // monkey patch because somehow JSON.stringify(e: Error) will always result in {}
  errors: [{ name: error.name, message: error.message }],
});
