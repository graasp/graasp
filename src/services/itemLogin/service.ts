import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, PermissionLevel, UUID } from '@graasp/sdk';

import { asDefined, assertIsDefined } from '../../utils/assertions';
import { InvalidPassword } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { verifyCurrentPassword } from '../auth/plugins/password/utils';
import { Actor, Member } from '../member/entities/member';
import { Guest } from './entities/guest';
import { ItemLoginSchema } from './entities/itemLoginSchema';
import {
  CannotRegisterOnFrozenItemLoginSchema,
  ItemLoginSchemaNotFound,
  MissingCredentialsForLoginSchema,
} from './errors';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { loginSchemaRequiresPassword } from './utils';

@singleton()
export class ItemLoginService {
  async getSchemaType(actor: Actor, repositories: Repositories, itemPath: string) {
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getOneByItemPath(itemPath);
    return itemLoginSchema?.type;
  }

  async getByItemPath({ itemLoginSchemaRepository }: Repositories, itemPath: string) {
    return await itemLoginSchemaRepository.getOneByItemPath(itemPath);
  }

  async logInOrRegister(
    repositories: Repositories,
    itemId: string,
    credentials: ItemLoginMemberCredentials,
  ) {
    const { username, password } = credentials; // TODO: allow for "empty" username and generate one (anonymous, anonymous+password)
    let bondMember: Guest | undefined = undefined;
    if (username) {
      bondMember = await this.logInOrRegisterWithUsername(repositories, itemId, {
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
    repositories: Repositories,
    itemId: UUID,
    { username, password }: { username: string; password?: string },
  ) {
    const {
      itemLoginRepository: guestRepository,
      itemRepository,
      itemLoginSchemaRepository,
      guestPasswordRepository,
      itemMembershipRepository,
    } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);

    // initial validation
    // this throws if does not exist
    const itemLoginSchema = await itemLoginSchemaRepository.getOneByItemPathOrThrow(
      item.path,
      ItemLoginSchemaNotFound,
      { itemPath: item.path },
    );

    if (itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new ItemLoginSchemaNotFound();
    }

    let guestAccount = await guestRepository.getForItemAndUsername(item, username);

    // reuse existing item login for this user
    if (guestAccount && loginSchemaRequiresPassword(itemLoginSchema.type)) {
      password = asDefined(password, MissingCredentialsForLoginSchema);
      const accountPassword = await guestPasswordRepository.getForGuestId(guestAccount.id);
      if (accountPassword) {
        if (!(await verifyCurrentPassword(accountPassword, password))) {
          throw new InvalidPassword();
        }
      } else {
        // If schema was modified from passwordless to '* + password' - update member with password
        await guestPasswordRepository.patch(guestAccount.id, password);
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
      guestAccount = await guestRepository.addOne(data);
      assertIsDefined(guestAccount);
      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        password = asDefined(password, MissingCredentialsForLoginSchema);
        await guestPasswordRepository.patch(guestAccount.id, password);
      }

      // create membership
      await itemMembershipRepository.addOne({
        itemPath: itemLoginSchema.item.path,
        accountId: guestAccount.id,
        creatorId: guestAccount.id,
        permission: PermissionLevel.Read,
      });
    }

    const refreshedMember = await repositories.itemLoginRepository.refreshLastAuthenticatedAt(
      guestAccount.id,
    );

    return refreshedMember;
  }

  async create(
    { itemLoginSchemaRepository }: Repositories,
    itemPath: string,
    type?: ItemLoginSchema['type'],
  ) {
    return itemLoginSchemaRepository.addOne({ itemPath, type });
  }

  async update(
    { itemLoginSchemaRepository }: Repositories,
    itemId: string,
    type?: ItemLoginSchema['type'],
    status?: ItemLoginSchema['status'],
  ) {
    return itemLoginSchemaRepository.updateOne(itemId, { type, status });
  }

  async getOneByItem(repositories: Repositories, itemId: string) {
    const { itemLoginSchemaRepository } = repositories;
    return await itemLoginSchemaRepository.getOneByItemId(itemId);
  }

  async delete(member: Member, repositories: Repositories, itemId: string) {
    const { itemLoginSchemaRepository } = repositories;

    return itemLoginSchemaRepository.deleteOneByItemId(itemId);
  }
}
