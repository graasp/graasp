import { DataSource } from 'typeorm';

import { Action } from '../services/action/entities/action';
import { MemberPassword } from '../services/auth/plugins/password/entities/password';
import { ChatMessage } from '../services/chat/chatMessage';
import { ChatMention } from '../services/chat/plugins/mentions/chatMention';
import { Invitation } from '../services/invitation/invitation';
import { Item } from '../services/item/entities/Item';
import { ActionRequestExport } from '../services/item/plugins/action/requestExport/requestExport';
import { AppAction } from '../services/item/plugins/app/appAction/appAction';
import { AppData } from '../services/item/plugins/app/appData/appData';
import { AppSetting } from '../services/item/plugins/app/appSetting/appSettings';
import { App } from '../services/item/plugins/app/entities/app';
import { Publisher } from '../services/item/plugins/app/entities/publisher';
import { Category } from '../services/item/plugins/itemCategory/entities/Category';
import { ItemCategory } from '../services/item/plugins/itemCategory/entities/ItemCategory';
import { ItemFavorite } from '../services/item/plugins/itemFavorite/entities/ItemFavorite';
import { ItemFlag } from '../services/item/plugins/itemFlag/itemFlag';
import { ItemLike } from '../services/item/plugins/itemLike/itemLike';
import { ItemTag } from '../services/item/plugins/itemTag/ItemTag';
import { ItemPublished } from '../services/item/plugins/published/entities/itemPublished';
import { RecycledItemData } from '../services/item/plugins/recycled/RecycledItemData';
import { ItemValidation } from '../services/item/plugins/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../services/item/plugins/validation/entities/ItemValidationGroup';
import { ItemValidationReview } from '../services/item/plugins/validation/entities/itemValidationReview';
import { ItemLogin } from '../services/itemLogin/entities/itemLogin';
import { ItemLoginSchema } from '../services/itemLogin/entities/itemLoginSchema';
import { ItemMembership } from '../services/itemMembership/entities/ItemMembership';
import { Member } from '../services/member/entities/member';

const slaves = process.env.DB_READ_REPLICA_HOST
  ? [
      {
        host: process.env.DB_READ_REPLICA_HOST,
        port: 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
    ]
  : [];

export const AppDataSource = new DataSource({
  type: 'postgres',
  replication: {
    master: {
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    slaves,
  },

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
  ],
  // refer to built files in js because it cannot run ts files
  migrations: ['dist/migrations/*.js'],
});
