import { FindOptionsSelect } from 'typeorm';

import { Action } from '../../../../action/entities/action';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { Item } from '../../../../item/entities/Item';
import { AppAction } from '../../../../item/plugins/app/appAction/appAction';
import { AppData } from '../../../../item/plugins/app/appData/appData';
import { AppSetting } from '../../../../item/plugins/app/appSetting/appSettings';
import { ItemCategory } from '../../../../item/plugins/itemCategory/entities/ItemCategory';
import { ItemFavorite } from '../../../../item/plugins/itemFavorite/entities/ItemFavorite';
import { ItemLike } from '../../../../item/plugins/itemLike/itemLike';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../entities/member';

export const selectExternalItems: FindOptionsSelect<Item> = {
  id: true,
  name: true,
  displayName: true,
};

export const selectExternalMembers: FindOptionsSelect<Member> = {
  name: true,
};

export const selectActions: FindOptionsSelect<Action> = {
  id: true,
  view: true,
  type: true,
  // Specify it as an object, indicating it should be included
  extra: {},
  createdAt: true,
  item: selectExternalItems,
};

export const selectAppActions: FindOptionsSelect<AppAction> = {
  id: true,
  data: {},
  type: true,
  createdAt: true,
  item: selectExternalItems,
};

export const selectAppSettings: FindOptionsSelect<AppSetting> = {
  id: true,
  data: {},
  name: true,
  createdAt: true,
  updatedAt: true,
  item: selectExternalItems,
};

export const selectAppData: FindOptionsSelect<AppData> = {
  id: true,
  data: {},
  type: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  item: selectExternalItems,
  creator: selectExternalMembers,
  member: selectExternalMembers,
};

const commonChatMessages: FindOptionsSelect<ChatMessage> = {
  // Be careful, if the ID is not selected, the returned message have an ID field but with the wrong UUID.
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
};
export const selectChatMessages: FindOptionsSelect<ChatMessage> = {
  ...commonChatMessages,
  item: selectExternalItems,
};

export const selectExternalChatMessages: FindOptionsSelect<ChatMessage> = {
  ...commonChatMessages,
  creator: { name: true },
};

export const selectChatMentions: FindOptionsSelect<ChatMention> = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  message: selectExternalChatMessages,
};

export const selectItemMemberships: FindOptionsSelect<ItemMembership> = {
  id: true,
  permission: true,
  createdAt: true,
  updatedAt: true,
  item: selectExternalItems,
};

export const selectItems: FindOptionsSelect<Item> = {
  id: true,
  name: true,
  type: true,
  description: true,
  path: true,
  extra: {},
  settings: {},
  lang: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  creator: selectExternalMembers,
};

export const selectItemCategories: FindOptionsSelect<ItemCategory> = {
  id: true,
  createdAt: true,
  item: selectExternalItems,
  category: {
    // even when not select, category has an id...
    id: true,
    name: true,
    type: true,
  },
};

export const selectItemFavorites: FindOptionsSelect<ItemFavorite> = {
  id: true,
  createdAt: true,
  item: selectExternalItems,
};

export const selectItemLikes: FindOptionsSelect<ItemLike> = {
  id: true,
  createdAt: true,
  item: selectExternalItems,
};
