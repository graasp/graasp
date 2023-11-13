/**
 * Item websocket events are registered under these topics
 */
import { ResultOf } from '@graasp/sdk';

import { Item } from '../entities/Item';

// changes on item entities
export const itemTopic = 'item';
// changes on items of given user
export const memberItemsTopic = 'item/member';

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
export const ChildItemEvent = (op: ChildItemEvent['op'], item: Item): ChildItemEvent => ({
  kind: 'child',
  op,
  item,
});

/**
 * Events that affect own items of given user
 */
interface OwnItemsEvent extends ItemEvent {
  kind: 'own';
  op: 'create' | 'delete' | 'update';
  item: Item;
}

/**
 * Factory of OwnItemsEvent
 * @param op operation of the event
 * @param item  value of the item for this event
 * @returns instance of own items event
 */
export const OwnItemsEvent = (op: OwnItemsEvent['op'], item: Item): OwnItemsEvent => ({
  kind: 'own',
  op,
  item,
});

/**
 * Events that affect shared items of given user
 */
interface SharedItemsEvent extends ItemEvent {
  kind: 'shared';
  op: 'create' | 'delete' | 'update';
  item: Item;
}

/**
 * Factory of SharedItemsEvent
 * @param op operation of the event
 * @param item  value of the item for this event
 * @returns instance of shared items event
 */
export const SharedItemsEvent = (op: SharedItemsEvent['op'], item: Item): SharedItemsEvent => ({
  kind: 'shared',
  op,
  item,
});

/**
 * Events from asynchronous background operations on given items
 */
interface ItemOpFeedbackEvent {
  kind: 'feedback';
  op: 'update' | 'delete' | 'move' | 'copy' | 'export' | 'recycle' | 'restore' | 'validate';
  resource: Item['id'][];
  result:
    | {
        error: Error;
      }
    | ResultOf<Item>;
}

/**
 * Factory of ItemOpFeedbackEvent
 * @param op operation of the event
 * @param resource original item ids on which the operation was performed
 * @param result result of the asynchronous operation
 * @returns
 */
export const ItemOpFeedbackEvent = (
  op: ItemOpFeedbackEvent['op'],
  resource: ItemOpFeedbackEvent['resource'],
  result: ItemOpFeedbackEvent['result'],
): ItemOpFeedbackEvent => ({
  kind: 'feedback',
  op,
  resource,
  result: result['error']
    ? // monkey patch because somehow JSON.stringify(e: Error) will always result in {}
      { error: { name: result['error'].name, message: result['error'].message } }
    : result,
});
