import { DataSource } from 'typeorm';

import { DB_TEST_SCHEMA } from '../../../test/constants';
import { Action } from '../../services/action/entities/action';
import { MemberPassword } from '../../services/auth/plugins/password/entities/password';
import { ChatMessage } from '../../services/chat/chatMessage';
import { ChatMention } from '../../services/chat/plugins/mentions/chatMention';
import { Invitation } from '../../services/invitation/invitation';
import { Item } from '../../services/item/entities/Item';
import { ActionRequestExport } from '../../services/item/plugins/action/requestExport/requestExport';
import { AppAction } from '../../services/item/plugins/app/appAction/appAction';
import { AppData } from '../../services/item/plugins/app/appData/appData';
import { AppSetting } from '../../services/item/plugins/app/appSetting/appSettings';
import { App } from '../../services/item/plugins/app/entities/app';
import { Publisher } from '../../services/item/plugins/app/entities/publisher';
import { RecycledItemData } from '../../services/item/plugins/recycled/RecycledItemData';
import { ItemValidation } from '../../services/item/plugins/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../../services/item/plugins/validation/entities/ItemValidationGroup';
import { ItemValidationReview } from '../../services/item/plugins/validation/entities/itemValidationReview';
import { Category } from '../../services/item/plugins/itemCategory/entities/Category';
import { ItemCategory } from '../../services/item/plugins/itemCategory/entities/ItemCategory';
import { ItemFlag } from '../../services/item/plugins/itemFlag/itemFlag';
import { ItemLike } from '../../services/item/plugins/itemLike/itemLike';
import { ItemLogin } from '../../services/itemLogin/entities/itemLogin';
import { ItemLoginSchema } from '../../services/itemLogin/entities/itemLoginSchema';
import { ItemMembership } from '../../services/itemMembership/entities/ItemMembership';
import { ItemTag } from '../../services/item/plugins/itemTag/ItemTag';
import { Member } from '../../services/member/entities/member';
import { ItemPublished } from '../../services/item/plugins/published/entities/itemPublished';

// mock data source
// we could use the original file, but for extra security we keep this file
// dropSchema and synchronize could kill the database
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'docker',
  password: 'docker',
  database: 'typeorm',
  // IMPORTANT: this ensure we don't use the same table as the prod/dev one
  // does not work for test since migrations are based on 'public'
  schema: DB_TEST_SCHEMA,
  dropSchema: true,
  synchronize: true,
  logging: ['error'],
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
    RecycledItemData,
    ChatMention,
    ItemLike,
    ItemTag,
    Category,
    ItemCategory,
    Invitation,
    ItemPublished,
    ItemFlag,
    ItemValidation,
    ItemValidationGroup,
    ItemValidationReview,
    Action,
    ActionRequestExport,
  ],
  // refer to built files in js because it cannot run ts files
  migrations: ['dist/migrations/*.js'],
});
