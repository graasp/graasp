import { Item } from '../interfaces/item';

/**
 * Item websocket events are registered under these topics
 */
// changes on item entities
export const itemTopic = 'item';
// changes on items of given user
export const memberItemsTopic = 'item/member';

/**
 * All websocket events for items will have this shape
 */
interface ItemEvent {
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
 * @returns instnace of own items event
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
 * Facctory of SharedItemsEvent
 * @param op operation of the event
 * @param item  value of the item for this event
 * @returns instnace of shared items event
 */
export const SharedItemsEvent = (op: SharedItemsEvent['op'], item: Item): SharedItemsEvent => ({
  kind: 'shared',
  op,
  item,
});
