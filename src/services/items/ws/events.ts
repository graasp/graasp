import { Item } from "../interfaces/item";

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
  kind: "self";
  op: "update" | "delete";
  item: Item;
}

/**
 * Factory of SelfItemEvent
 * @param op operation of the event
 * @param item value of the item for this event
 * @returns instance of self item event
 */
export const SelfItemEvent = (op: SelfItemEvent["op"], item: Item): SelfItemEvent => ({
  kind: "self",
  op,
  item,
});

/**
 * Events that affect parents on their children
 */
interface ChildItemEvent extends ItemEvent {
  kind: "child";
  op: "create" | "delete" | "update";
  item: Item;
}

/**
 * Factory of ChildItemEvent
 * @param op operation of the event
 * @param item value of the item for this event
 * @returns instance of child item event
 */
export const ChildItemEvent = (op: ChildItemEvent["op"], item: Item): ChildItemEvent => ({
  kind: "child",
  op,
  item,
});
