import { DataSource } from 'typeorm';

import { MemberPassword } from '../services/auth/plugins/password/entities/password';
import { ChatMessage } from '../services/chat/chatMessage';
import { ChatMention } from '../services/chat/plugins/mentions/chatMention';
import { Invitation } from '../services/invitation/invitation';
import { Item } from '../services/item/entities/Item';
import { AppAction } from '../services/item/plugins/app/appAction/appAction';
import { AppData } from '../services/item/plugins/app/appData/appData';
import { AppSetting } from '../services/item/plugins/app/appSetting/appSettings';
import { App } from '../services/item/plugins/app/entities/app';
import { Publisher } from '../services/item/plugins/app/entities/publisher';
import { RecycledItemData } from '../services/item/plugins/recycled/RecycledItemData';
import { ItemValidation } from '../services/item/plugins/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../services/item/plugins/validation/entities/ItemValidationGroup';
import { ItemValidationReview } from '../services/item/plugins/validation/entities/itemValidationReview';
import { Category } from '../services/itemCategory/entities/Category';
import { ItemCategory } from '../services/itemCategory/entities/ItemCategory';
import { ItemFlag } from '../services/itemFlag/itemFlag';
import { ItemLike } from '../services/itemLike/itemLike';
import { ItemLogin } from '../services/itemLogin/entities/itemLogin';
import { ItemLoginSchema } from '../services/itemLogin/entities/itemLoginSchema';
import { ItemMembership } from '../services/itemMembership/entities/ItemMembership';
import { ItemTag } from '../services/itemTag/ItemTag';
import { Member } from '../services/member/entities/member';
import { ItemPublished } from '../services/published/entities/itemPublished';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,

  // replication: {
  //   master: {
  //     host: "server1",
  //     port: 3306,
  //     username: "test",
  //     password: "test",
  //     database: "test"
  //   },
  //   slaves: [{
  //     host: "server2",
  //     port: 3306,
  //     username: "test",
  //     password: "test",
  //     database: "test"
  //   }, {
  //     host: "server3",
  //     port: 3306,
  //     username: "test",
  //     password: "test",
  //     database: "test"
  //   }]
  // }

  // cache: true, // TODO
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, 
  logging: true,
  migrationsRun: true,

  // TODO: REMOVE
  // dropSchema: true,
  // synchronize: true,

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
    ItemCategory,
    ItemFlag,
    Invitation,
    ItemValidation,
    ItemValidationGroup,
    ItemValidationReview,
  ],
  // refer to built files in js because it cannot run ts files
  migrations: ['dist/migrations/*.js'],
});
