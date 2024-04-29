/**
 * Item websocket events are registered under these topics
 */
import { FeedBackOPType, ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { Item } from '../entities/Item';

// changes on item entities
export const itemTopic = 'item';
// changes on items of given user
export const memberItemsTopic = 'item/member';
// changes on items of given user
export const copyItemsTopic = 'item/copy';

/**
 * All websocket events for items will have this shape
 */
export interface ItemEvent {
  kind: string;
  op: string;
  item: Item;
}

/**
 * Events that affect each item itself
 */
interface SelfItemEvent extends ItemEvent {
  kind: 'self';
  op: 'update' | 'delete';
  item: Item;
}

/**
 * Factory of SelfItemEvent
 * @param op operation of the event
 * @param item value of the item for this event
 * @returns instance of self item event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const SelfItemEvent = (op: SelfItemEvent['op'], item: Item): SelfItemEvent => ({
  kind: 'self',
  op,
  item,
});

/**
 * Events that affect parents on their children
 */
interface ChildItemEvent extends ItemEvent {
  kind: 'child';
  op: 'create' | 'delete' | 'update';
  item: Item;
}

/**
 * Factory of ChildItemEvent
 * @param op operation of the event
 * @param item value of the item for this event
 * @returns instance of child item event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ChildItemEvent = (op: ChildItemEvent['op'], item: Item): ChildItemEvent => ({
  kind: 'child',
  op,
  item,
});

/**
 * Factory of ItemOpFeedbackEvent
 * @param op operation of the event
 * @param resource original item ids on which the operation was performed
 * @param result result of the asynchronous operation
 * @returns
 */
export const ItemOpFeedbackEvent = <T extends FeedBackOPType>(
  op: T,
  resource: ItemOpFeedbackEventType<Item, T>['resource'],
  result: ItemOpFeedbackEventType<Item, T>['result'],
  errors?: Error[],
): ItemOpFeedbackEventType<Item, T> => ({
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
export const ItemOpFeedbackErrorEvent = <T extends FeedBackOPType>(
  op: T,
  resource: ItemOpFeedbackEventType<Item, T>['resource'],
  error: Error,
): ItemOpFeedbackEventType<Item, T> => ({
  kind: 'feedback',
  op,
  resource,
  // monkey patch because somehow JSON.stringify(e: Error) will always result in {}
  errors: [{ name: error.name, message: error.message }],
});
