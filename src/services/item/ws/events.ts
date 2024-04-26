/**
 * Item websocket events are registered under these topics
 */
import { ResultOf } from '@graasp/sdk';

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
 * Events from asynchronous background operations on given items
 */
interface ItemOpFeedbackEvent {
  kind: 'feedback';
  // op: 'update' | 'delete' | 'move' | 'export' | 'recycle' | 'restore' | 'validate';
  resource: Item['id'][];
  // result:
  //   | {
  //       error: Error;
  //     }
  //   | ResultOf<Item>;
}

type CopyEvent = ItemOpFeedbackEvent & {
  op: 'copy';
  result:
    | {
        error: Error;
      }
    | { items: Item[]; copies: Item[] };
};

type MoveEvent = ItemOpFeedbackEvent & {
  op: 'move';
  result:
    | {
        error: Error;
      }
    | { items: Item[]; moved: Item[] };
};

export type ItemOpFeedbackEventType = CopyEvent | MoveEvent;
