import { DataSource } from 'typeorm';

import { Action } from '../services/action/entities/action.js';
import { MemberPassword } from '../services/auth/plugins/password/entities/password.js';
import { ChatMessage } from '../services/chat/chatMessage.js';
import { ChatMention } from '../services/chat/plugins/mentions/chatMention.js';
import { Item } from '../services/item/entities/Item.js';
import { ActionRequestExport } from '../services/item/plugins/action/requestExport/requestExport.js';
import { AppAction } from '../services/item/plugins/app/appAction/appAction.js';
import { AppData } from '../services/item/plugins/app/appData/appData.js';
import { AppSetting } from '../services/item/plugins/app/appSetting/appSettings.js';
import { App } from '../services/item/plugins/app/entities/app.js';
import { Publisher } from '../services/item/plugins/app/entities/publisher.js';
import { ItemGeolocation } from '../services/item/plugins/geolocation/ItemGeolocation.js';
import { Invitation } from '../services/item/plugins/invitation/entity.js';
import { Category } from '../services/item/plugins/itemCategory/entities/Category.js';
import { ItemCategory } from '../services/item/plugins/itemCategory/entities/ItemCategory.js';
import { ItemFavorite } from '../services/item/plugins/itemFavorite/entities/ItemFavorite.js';
import { ItemFlag } from '../services/item/plugins/itemFlag/itemFlag.js';
import { ItemLike } from '../services/item/plugins/itemLike/itemLike.js';
import { ItemTag } from '../services/item/plugins/itemTag/ItemTag.js';
import { ItemPublished } from '../services/item/plugins/published/entities/itemPublished.js';
import { RecycledItemData } from '../services/item/plugins/recycled/RecycledItemData.js';
import { ShortLink } from '../services/item/plugins/shortLink/entities/ShortLink.js';
import { ItemValidation } from '../services/item/plugins/validation/entities/ItemValidation.js';
import { ItemValidationGroup } from '../services/item/plugins/validation/entities/ItemValidationGroup.js';
import { ItemValidationReview } from '../services/item/plugins/validation/entities/itemValidationReview.js';
import { ItemLogin } from '../services/itemLogin/entities/itemLogin.js';
import { ItemLoginSchema } from '../services/itemLogin/entities/itemLoginSchema.js';
import { ItemMembership } from '../services/itemMembership/entities/ItemMembership.js';
import { Member } from '../services/member/entities/member.js';
import { MemberProfile } from '../services/member/plugins/profile/entities/profile.js';
import {
  DB_CONNECTION_POOL_SIZE,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_READ_REPLICA_HOSTS,
  DB_USERNAME,
} from '../utils/config.js';

const slaves = DB_READ_REPLICA_HOSTS.map((host) => ({
  host,
  port: 5432,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
}));

export const AppDataSource = new DataSource({
  type: 'postgres',
  replication: {
    master: {
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_NAME,
    },
    slaves,
  },
  poolSize: DB_CONNECTION_POOL_SIZE, // *2 because of the number of tasks
  // log queries that take more than 2s to execute
  maxQueryExecutionTime: 2000,
  logging: ['migration', 'error'],
  migrationsRun: true,

  entities: [
    Member,
    Item,
    ItemMembership,
    MemberPassword,
    ItemLogin,
    ItemLoginSchema,
    Publisher,
    App,
    AppData,
    AppAction,
    AppSetting,
    ChatMessage,
    ChatMention,
    ItemPublished,
    RecycledItemData,
    ItemLike,
    ItemTag,
    Category,
    ItemFavorite,
    ItemCategory,
    ItemFlag,
    Invitation,
    ItemValidation,
    ItemValidationGroup,
    ItemValidationReview,
    Action,
    ActionRequestExport,
    MemberProfile,
    ShortLink,
    ItemGeolocation,
  ],
  // refer to built files in js because it cannot run ts files
  migrations: ['dist/migrations/*.js'],
});
