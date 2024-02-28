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
 * Events that affect root items the user has access to
 */
interface AccessibleItemsEvent extends ItemEvent {
  kind: 'accessible';
  op: 'create' | 'delete' | 'update';
  item: Item;
}
/**
 * Factory of AccessibleItemsEvent
 * @param op operation of the event
 * @param item  value of the item for this event
 * @returns instance of accessible items event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const AccessibleItemsEvent = (
  op: OwnItemsEvent['op'],
  item: Item,
): AccessibleItemsEvent => ({
  kind: 'accessible',
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const SharedItemsEvent = (op: SharedItemsEvent['op'], item: Item): SharedItemsEvent => ({
  kind: 'shared',
  op,
  item,
});

export const ResultOfFactory = {
  withError: (e: Error) => ResultOfFactory.withErrors([e]),
  withErrors: (errors: Error[]) => ({ data: {}, errors }),
};

/**
 * Events from asynchronous background operations on given items
 */
export interface ItemOpFeedbackEventInterface {
  kind: 'feedback';
  op: 'update' | 'delete' | 'move' | 'copy' | 'export' | 'recycle' | 'restore' | 'validate';
  resource: Item['id'][];
  result: ResultOf<Item>;
}

/**
 * Factory of ItemOpFeedbackEvent
 * @param op operation of the event
 * @param resource original item ids on which the operation was performed
 * @param result result of the asynchronous operation
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ItemOpFeedbackEvent = (
  op: ItemOpFeedbackEventInterface['op'],
  resource: ItemOpFeedbackEventInterface['resource'],
  result: ItemOpFeedbackEventInterface['result'],
): ItemOpFeedbackEventInterface => ({
  kind: 'feedback',
  op,
  resource,
  result: {
    data: result.data,
    // monkey patch because JSON.stringify(e: Error) will always result in {}
    errors: result.errors.map((e) => ({
      name: e.name,
      message: e.message,
    })),
  },
});
