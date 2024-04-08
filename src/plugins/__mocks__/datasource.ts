import { DataSource } from 'typeorm';

import { DB_TEST_SCHEMA } from '../../../test/constants';
import { Action } from '../../services/action/entities/action';
import { MemberPassword } from '../../services/auth/plugins/password/entities/password';
import { ChatMessage } from '../../services/chat/chatMessage';
import { ChatMention } from '../../services/chat/plugins/mentions/chatMention';
import { Item } from '../../services/item/entities/Item';
import { ActionRequestExport } from '../../services/item/plugins/action/requestExport/requestExport';
import { AppAction } from '../../services/item/plugins/app/appAction/appAction';
import { AppData } from '../../services/item/plugins/app/appData/appData';
import { AppSetting } from '../../services/item/plugins/app/appSetting/appSettings';
import { App } from '../../services/item/plugins/app/entities/app';
import { Publisher } from '../../services/item/plugins/app/entities/publisher';
import { ItemGeolocation } from '../../services/item/plugins/geolocation/ItemGeolocation';
import { Invitation } from '../../services/item/plugins/invitation/entity';
import { Category } from '../../services/item/plugins/itemCategory/entities/Category';
import { ItemCategory } from '../../services/item/plugins/itemCategory/entities/ItemCategory';
import { ItemFavorite } from '../../services/item/plugins/itemFavorite/entities/ItemFavorite';
import { ItemFlag } from '../../services/item/plugins/itemFlag/itemFlag';
import { ItemLike } from '../../services/item/plugins/itemLike/itemLike';
import { ItemTag } from '../../services/item/plugins/itemTag/ItemTag';
import { ItemPublished } from '../../services/item/plugins/published/entities/itemPublished';
import { RecycledItemData } from '../../services/item/plugins/recycled/RecycledItemData';
import { ShortLink } from '../../services/item/plugins/shortLink/entities/ShortLink';
import { ItemValidation } from '../../services/item/plugins/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../../services/item/plugins/validation/entities/ItemValidationGroup';
import { ItemValidationReview } from '../../services/item/plugins/validation/entities/itemValidationReview';
import { ItemLogin } from '../../services/itemLogin/entities/itemLogin';
import { ItemLoginSchema } from '../../services/itemLogin/entities/itemLoginSchema';
import { ItemMembership } from '../../services/itemMembership/entities/ItemMembership';
import { Member } from '../../services/member/entities/member';
import { MemberProfile } from '../../services/member/plugins/profile/entities/profile';
import { DB_PORT } from '../../utils/config';

// mock data source
// we could use the original file, but for extra security we keep this file
// dropSchema and synchronize could kill the database
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'graasp-postgres-test',
  port:
    process.env.CI === 'true' ? 5432 + parseInt(process.env.JEST_WORKER_ID ?? '1') - 1 : DB_PORT,
  username: process.env.DB_USERNAME ?? 'docker-test',
  password: process.env.DB_PASSWORD ?? 'docker-test',
  database: process.env.DB_NAME ?? 'docker-test',
  // This was an attempt to ensure we don't use the same table as the prod/dev one
  // BUT it DOES NOT WORK for test since migrations are based on 'public'
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
