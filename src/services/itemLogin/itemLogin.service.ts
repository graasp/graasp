import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { MinimalAccount } from '../../drizzle/types';
import { MaybeUser } from '../../types';
import { asDefined, assertIsDefined } from '../../utils/assertions';
import { InvalidPassword } from '../../utils/errors';
import { verifyCurrentPassword } from '../auth/plugins/password/utils';
import { ItemRepository } from '../item/item.repository';
import { ItemMembershipRepository } from '../itemMembership/membership.repository';
import {
  CannotRegisterOnFrozenItemLoginSchema,
  ItemLoginSchemaNotFound,
  MissingCredentialsForLoginSchema,
} from './errors';
import { GuestRepository } from './guest.repository';
import { GuestPasswordRepository } from './guestPassword.repository';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { ItemLoginSchemaRepository, ItemSchemaTypeOptions } from './itemLoginSchema.repository';
import { loginSchemaRequiresPassword } from './utils';

@singleton()
export class ItemLoginService {
  private readonly itemLoginSchemaRepository: ItemLoginSchemaRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemRepository: ItemRepository;
  private readonly guestRepository: GuestRepository;
  private readonly guestPasswordRepository: GuestPasswordRepository;

  constructor(
    itemLoginSchemaRepository: ItemLoginSchemaRepository,
    itemRepository: ItemRepository,
    itemMembershipRepository: ItemMembershipRepository,
    guestRepository: GuestRepository,
    guestPasswordRepository: GuestPasswordRepository,
  ) {
    this.itemLoginSchemaRepository = itemLoginSchemaRepository;
    this.itemRepository = itemRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.guestRepository = guestRepository;
    this.guestPasswordRepository = guestPasswordRepository;
  }

  async getSchemaType(dbConnection: DBConnection, actor: MaybeUser, itemPath: string) {
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema = await this.itemLoginSchemaRepository.getOneByItemPath(
      dbConnection,
      itemPath,
    );
    return itemLoginSchema?.type;
  }

  async getByItemPath(dbConnection: DBConnection, itemPath: string) {
    return await this.itemLoginSchemaRepository.getOneByItemPath(dbConnection, itemPath);
  }

  async logInOrRegister(
    dbConnection: DBConnection,
    itemId: string,
    credentials: ItemLoginMemberCredentials,
  ): Promise<MinimalAccount> {
    const { username, password } = credentials;

    if (!username) {
      throw new Error('It is currently not supported to login without a username');
    }

    const guest = await this.logInOrRegisterWithUsername(dbConnection, itemId, {
      username,
      password,
    });
    return guest;
  }

  async logInOrRegisterWithUsername(
    dbConnection: DBConnection,
    itemId: UUID,
    { username, password }: { username: string; password?: string },
  ): Promise<MinimalAccount> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    // initial validation
    // this throws if does not exist
    const itemLoginSchema = await this.itemLoginSchemaRepository.getOneByItemPath(
      dbConnection,
      item.path,
    );
    if (!itemLoginSchema) {
      throw new ItemLoginSchemaNotFound(item.path);
    }

    if (itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new ItemLoginSchemaNotFound();
    }

    const existingAccount = await this.guestRepository.getForItemAndUsername(
      dbConnection,
      item,
      username,
    );
    let guestAccount = existingAccount
      ? { id: existingAccount.id, name: existingAccount.name }
      : undefined;
    // reuse existing item login for this user
    if (guestAccount && loginSchemaRequiresPassword(itemLoginSchema.type)) {
      password = asDefined(password, MissingCredentialsForLoginSchema);
      const accountPassword = await this.guestPasswordRepository.getForGuestId(
        dbConnection,
        guestAccount.id,
      );
      if (accountPassword) {
        if (!(await verifyCurrentPassword(accountPassword, password))) {
          throw new InvalidPassword();
        }
      } else {
        // If schema was modified from passwordless to '* + password' - update member with password
        await this.guestPasswordRepository.put(dbConnection, guestAccount.id, password);
      }
    }
    // create a new item login
    else if (!guestAccount) {
      if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
        throw new CannotRegisterOnFrozenItemLoginSchema();
      }

      // create member w/ `username`
      const data = {
        name: username,
        itemLoginSchemaId: itemLoginSchema.id,
      };

      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        // Check before creating account, so we don't create an account w/o password if it's required
        asDefined(password, MissingCredentialsForLoginSchema);
      }

      // create account
      guestAccount = await this.guestRepository.addOne(dbConnection, data);
      assertIsDefined(guestAccount);
      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        password = asDefined(password, MissingCredentialsForLoginSchema);
        await this.guestPasswordRepository.put(dbConnection, guestAccount.id, password);
      }

      // create membership
      await this.itemMembershipRepository.addOne(dbConnection, {
        itemPath: itemLoginSchema.item.path,
        accountId: guestAccount.id,
        creatorId: guestAccount.id,
        permission: PermissionLevel.Read,
      });
    }

    const refreshedMember = await this.guestRepository.refreshLastAuthenticatedAt(
      dbConnection,
      guestAccount.id,
    );
    return { id: refreshedMember.id, name: refreshedMember.name };
  }

  async updateOrCreate(
    dbConnection: DBConnection,
    itemPath: string,
    type?: ItemSchemaTypeOptions,
    status?: `${ItemLoginSchemaStatus}`,
  ) {
    await this.itemLoginSchemaRepository.put(dbConnection, itemPath, {
      type,
      status,
    });
  }

  async getOneByItem(dbConnection: DBConnection, itemId: string) {
    return await this.itemLoginSchemaRepository.getOneByItemId(dbConnection, itemId);
  }

  async delete(dbConnection: DBConnection, itemId: string) {
    return this.itemLoginSchemaRepository.deleteOneByItemId(dbConnection, itemId);
  }
}
