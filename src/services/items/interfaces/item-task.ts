// local
import { Item } from './item';

export interface ItemMoveHookHandlerExtraData {
  destination: Item;
}

export interface ItemCopyHookHandlerExtraData {
  original: Item;
}
