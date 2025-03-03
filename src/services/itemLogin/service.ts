import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { GuestRaw } from '../../drizzle/types';
import { MaybeUser } from '../../types';
import { asDefined, assertIsDefined } from '../../utils/assertions';
import { InvalidPassword } from '../../utils/errors';
import { verifyCurrentPassword } from '../auth/plugins/password/utils';
import { ItemRepository } from '../item/repository';
import {
    CannotRegisterOnFrozenItemLoginSchema,
    ItemLoginSchemaNotFound,
    MissingCredentialsForLoginSchema,
} from './errors';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { GuestRepository } from './repositories/guest';
import { GuestPasswordRepository } from './repositories/guestPassword';
import { ItemLoginSchemaRepository } from './repositories/itemLoginSchema';
import { loginSchemaRequiresPassword } from './utils';

@singleton()
export class ItemLoginService {
  private readonly itemLoginSchemaRepository: ItemLoginSchemaRepository;
  private readonly itemLoginRepository: ItemLoginRepository;
  private readonly itemRepository: ItemRepository;
  private readonly guestRepository: GuestRepository;
  private readonly guestPasswordRepository: GuestPasswordRepository;

  constructor(
    itemLoginSchemaRepository: ItemLoginSchemaRepository,
    itemRepository: ItemRepository,
    guestRepository: GuestRepository,
    guestPasswordRepository: GuestPasswordRepository,
  ) {
    this.itemLoginSchemaRepository = itemLoginSchemaRepository;
    this.itemRepository = itemRepository;
    this.guestRepository = guestRepository;
    this.guestPasswordRepository = guestPasswordRepository;
  }

  async getSchemaType(db: DBConnection, actor: MaybeUser, itemPath: string) {
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema =
      await this.itemLoginSchemaRepository.getOneByItemPath(db, itemPath);
    return itemLoginSchema?.type;
  }

  async getByItemPath(db: DBConnection, itemPath: string) {
    return await this.itemLoginSchemaRepository.getOneByItemPath(db, itemPath);
  }

  async logInOrRegister(
    db: DBConnection,
    itemId: string,
    credentials: ItemLoginMemberCredentials,
  ) {
    const { username, password } = credentials; // TODO: allow for "empty" username and generate one (anonymous, anonymous+password)
    let bondMember: GuestRaw | undefined = undefined;
    if (username) {
      bondMember = await this.logInOrRegisterWithUsername(db, itemId, {
        username,
        password,
      });
    }

    if (!bondMember) {
      // TODO
      throw new Error();
    }

    return bondMember;
  }

  async logInOrRegisterWithUsername(
    db: DBConnection,
    itemId: UUID,
    { username, password }: { username: string; password?: string },
  ) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // initial validation
    // this throws if does not exist
    const itemLoginSchema =
      await this.itemLoginSchemaRepository.getOneByItemPath(db, item.path);
    if (!itemLoginSchema) {
      throw new ItemLoginSchemaNotFound(item.path);
    }

    if (itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new ItemLoginSchemaNotFound();
    }

    let guestAccount = await this.guestRepository.getForItemAndUsername(
      db,
      item,
      username,
    );

    // reuse existing item login for this user
    if (guestAccount && loginSchemaRequiresPassword(itemLoginSchema.type)) {
      password = asDefined(password, MissingCredentialsForLoginSchema);
      const accountPassword = await this.guestPasswordRepository.getForGuestId(
        db,
        guestAccount.id,
      );
      if (accountPassword) {
        if (!(await verifyCurrentPassword(accountPassword, password))) {
          throw new InvalidPassword();
        }
      } else {
        // If schema was modified from passwordless to '* + password' - update member with password
        await this.guestPasswordRepository.patch(db, guestAccount.id, password);
      }
    }
    // create a new item login
    else if (!guestAccount) {
      if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
        throw new CannotRegisterOnFrozenItemLoginSchema();
      }

      // create member w/ `username`
      const data: Partial<Guest> & Pick<Guest, 'name'> = {
        name: username,
        itemLoginSchema: itemLoginSchema,
      };

      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        // Check before creating account, so we don't create an account w/o password if it's required
        asDefined(password, MissingCredentialsForLoginSchema);
      }

      // create account
      guestAccount = await this.guestRepository.addOne(db, data);
      assertIsDefined(guestAccount);
      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        password = asDefined(password, MissingCredentialsForLoginSchema);
        await this.guestPasswordRepository.patch(db, guestAccount.id, password);
      }

      // create membership
      await this.itemMembershipRepository.addOne(db, {
        itemPath: itemLoginSchema.item.path,
        accountId: guestAccount.id,
        creatorId: guestAccount.id,
        permission: PermissionLevel.Read,
      });
    }

    const refreshedMember =
      await this.guestRepository.refreshLastAuthenticatedAt(
        db,
        guestAccount.id,
      );

    return refreshedMember;
  }

  async create(
    db: DBConnection,
    itemPath: string,
    type?: ItemLoginSchema['type'],
  ) {
    return this.itemLoginSchemaRepository.addOne(db, { itemPath, type });
  }

  async update(
    db: DBConnection,
    itemId: string,
    type?: ItemLoginSchema['type'],
    status?: ItemLoginSchema['status'],
  ) {
    return this.itemLoginSchemaRepository.updateOne(db, itemId, {
      type,
      status,
    });
  }

  async getOneByItem(db: DBConnection, itemId: string) {
    return await this.itemLoginSchemaRepository.getOneByItemId(db, itemId);
  }

  async delete(db: DBConnection, member: Member, itemId: string) {
    return this.itemLoginSchemaRepository.deleteOneByItemId(db, itemId);
  }
}
