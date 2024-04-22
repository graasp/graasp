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
import { schemaToSelectMapper } from '../utils/selection.utils';
import {
  actionSchema,
  appActionSchema,
  appDataSchema,
  appSettingSchema,
  itemCategorySchema,
  itemFavoriteSchema,
  itemLikeSchema,
  itemMembershipSchema,
  itemSchema,
  messageMentionSchema,
  messageSchema,
} from './schemas';

export const selectActions = schemaToSelectMapper<Action>(actionSchema);

export const selectAppActions = schemaToSelectMapper<AppAction>(appActionSchema);

export const selectAppSettings = schemaToSelectMapper<AppSetting>(appSettingSchema);

export const selectAppData = schemaToSelectMapper<AppData>(appDataSchema);

export const selectChatMessages = schemaToSelectMapper<ChatMessage>(messageSchema);

export const selectChatMentions = schemaToSelectMapper<ChatMention>(messageMentionSchema);

export const selectItemMemberships = schemaToSelectMapper<ItemMembership>(itemMembershipSchema);

export const selectItems = schemaToSelectMapper<Item>(itemSchema);

export const selectItemCategories = schemaToSelectMapper<ItemCategory>(itemCategorySchema);

export const selectItemFavorites = schemaToSelectMapper<ItemFavorite>(itemFavoriteSchema);

export const selectItemLikes = schemaToSelectMapper<ItemLike>(itemLikeSchema);
