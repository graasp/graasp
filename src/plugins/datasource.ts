import { DataSource } from 'typeorm';

import { Account } from '../services/account/entities/account';
import { Action } from '../services/action/entities/action';
import { MemberPassword } from '../services/auth/plugins/password/entities/password';
import { ChatMessage } from '../services/chat/chatMessage';
import { ChatMention } from '../services/chat/plugins/mentions/chatMention';
import { Item } from '../services/item/entities/Item';
import { ActionRequestExport } from '../services/item/plugins/action/requestExport/requestExport';
import { AppAction } from '../services/item/plugins/app/appAction/appAction';
import { AppData } from '../services/item/plugins/app/appData/appData';
import { AppSetting } from '../services/item/plugins/app/appSetting/appSettings';
import { App } from '../services/item/plugins/app/entities/app';
import { Publisher } from '../services/item/plugins/app/entities/publisher';
import { ItemGeolocation } from '../services/item/plugins/geolocation/ItemGeolocation';
import { Invitation } from '../services/item/plugins/invitation/entity';
import { ItemFavorite } from '../services/item/plugins/itemFavorite/entities/ItemFavorite';
import { ItemFlag } from '../services/item/plugins/itemFlag/itemFlag';
import { ItemLike } from '../services/item/plugins/itemLike/itemLike';
import { ItemVisibility } from '../services/item/plugins/itemVisibility/ItemVisibility';
import { ItemPublished } from '../services/item/plugins/publication/published/entities/itemPublished';
import { ItemValidation } from '../services/item/plugins/publication/validation/entities/ItemValidation';
import { ItemValidationGroup } from '../services/item/plugins/publication/validation/entities/ItemValidationGroup';
import { ItemValidationReview } from '../services/item/plugins/publication/validation/entities/itemValidationReview';
import { RecycledItemData } from '../services/item/plugins/recycled/RecycledItemData';
import { ShortLink } from '../services/item/plugins/shortLink/entities/ShortLink';
import { ItemTag } from '../services/item/plugins/tag/ItemTag.entity';
import { Guest } from '../services/itemLogin/entities/guest';
import { GuestPassword } from '../services/itemLogin/entities/guestPassword';
import { ItemLoginSchema } from '../services/itemLogin/entities/itemLoginSchema';
import { ItemMembership } from '../services/itemMembership/entities/ItemMembership';
import { MembershipRequest } from '../services/itemMembership/plugins/MembershipRequest/entities/MembershipRequest';
import { Member } from '../services/member/entities/member';
import { MemberProfile } from '../services/member/plugins/profile/entities/profile';
import { Tag } from '../services/tag/Tag.entity';
import {
  AUTO_RUN_MIGRATIONS,
  DB_CONNECTION_POOL_SIZE,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_READ_REPLICA_HOSTS,
  DB_USERNAME,
  DEFAULT_DB_PORT,
  MASTER_DB_PORT,
} from '../utils/config';

const slaves = DB_READ_REPLICA_HOSTS.map((host) => ({
  host,
  port: DEFAULT_DB_PORT,
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
}));

export const AppDataSource = new DataSource({
  type: 'postgres',
  replication: {
    master: {
      host: DB_HOST,
      // in CI there will be a database per JEST worker
      port: MASTER_DB_PORT,
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
  migrationsRun: AUTO_RUN_MIGRATIONS,

  entities: [
    Member,
    Account,
    Guest,
    Item,
    ItemMembership,
    MembershipRequest,
    MemberPassword,
    GuestPassword,
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
    ItemVisibility,
    ItemFavorite,
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
    Tag,
    ItemTag,
  ],
  // refer to built files in js because it cannot run ts files
  migrations: ['dist/migrations/*.js'],
});
