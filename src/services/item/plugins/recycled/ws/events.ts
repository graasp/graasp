import { Item } from '../../../entities/Item';
import { ItemEvent } from '../../../ws/events';

/**
 * Events that affect the recycle bin
 */
interface RecycleBinEvent extends ItemEvent {
  kind: 'recycle_bin';
  op: 'create' | 'delete';
  item: Item;
}

/**
 * Factory of RecycleBinEvent
 * @param op operation of the event
 * @param item value of the item for this event
 * @returns instance of recycle bin event
 */
export const RecycleBinEvent = (op: RecycleBinEvent['op'], item: Item): RecycleBinEvent => ({
  kind: 'recycle_bin',
  op,
  item,
});
