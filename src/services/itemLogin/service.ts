import { FastifyInstance } from 'fastify';

import { ItemLoginSchemaType, PermissionLevel, UUID } from '@graasp/sdk';

import { assertNonNull, notUndefined } from '../../utils/assertions';
import { InvalidPassword } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { verifyCurrentPassword } from '../auth/plugins/password/utils';
import { ItemService } from '../item/service';
import { Actor, Member } from '../member/entities/member';
import { Guest } from './entities/guest';
import { ItemLoginSchemaNotFound, MissingCredentialsForLoginSchema } from './errors';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { loginSchemaRequiresPassword } from './utils';

export class ItemLoginService {
  fastify: FastifyInstance;
  private itemService: ItemService;

  constructor(fastify: FastifyInstance, itemService: ItemService) {
    this.fastify = fastify;
    this.itemService = itemService;
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    return await repositories.itemLoginSchemaRepository.getOneByItemPathOrThrow(
      item.path,
      ItemLoginSchemaNotFound,
      { itemPath: item.path },
    );
  }

  async getSchemaType(actor: Actor, repositories: Repositories, itemId: string) {
    const item = await repositories.itemRepository.getOneOrThrow(itemId);
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getOneByItemPath(
      item.path,
    );
    return itemLoginSchema?.type;
  }

  async login(repositories: Repositories, itemId: string, credentials: ItemLoginMemberCredentials) {
    const { username, password } = credentials; // TODO: allow for "empty" username and generate one (anonymous, anonymous+password)
    let bondMember: Guest | undefined = undefined;
    if (username) {
      bondMember = await this.loginWithUsername(repositories, itemId, {
        username,
        password,
      });
    }

    if (!bondMember) {
      // TODO
      throw new Error();
    }
    // TODO: mobile ???
    // app client
    // if (m) {
    //   // TODO: can this be dangerous? since it's available in the fastify scope?
    //   // can this be done better with decorators on request/reply?
    //   const tokens = this.fastify.generateAuthTokensPair(id);
    //   return Object.assign({ id, name }, { tokens });
    // }

    return bondMember;
  }

  async loginWithUsername(
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

    let guestAccount = await guestRepository.getForItemAndUsername(item, username);

    // reuse existing item login for this user
    if (guestAccount && loginSchemaRequiresPassword(itemLoginSchema.type)) {
      password = notUndefined(password, new MissingCredentialsForLoginSchema());
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
      // create member w/ `username`
      const data: Partial<Guest> & Pick<Guest, 'name'> = {
        name: username,
        itemLoginSchema: itemLoginSchema,
      };

      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        // Check before creating account, so we don't create an account w/o password if it's required
        notUndefined(password, new MissingCredentialsForLoginSchema());
      }

      // create account
      guestAccount = await guestRepository.addOne(data);
      assertNonNull(guestAccount);
      if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
        password = notUndefined(password, new MissingCredentialsForLoginSchema());
        await guestPasswordRepository.patch(guestAccount.id, password);
      }

      // create membership
      await itemMembershipRepository.post({
        item,
        account: guestAccount,
        creator: guestAccount,
        permission: PermissionLevel.Read,
      });
    }

    return guestAccount;
  }

  async create(
    { itemLoginSchemaRepository }: Repositories,
    itemPath: string,
    type?: ItemLoginSchemaType,
  ) {
    return itemLoginSchemaRepository.addOne({ itemPath, type });
  }

  async update(
    { itemLoginSchemaRepository }: Repositories,
    itemId: string,
    type: ItemLoginSchemaType,
  ) {
    return itemLoginSchemaRepository.updateOne(itemId, { type });
  }

  async getOneByItem(repositories: Repositories, itemId: string) {
    const { itemLoginSchemaRepository } = repositories;
    return await itemLoginSchemaRepository.getOneByItem(itemId);
  }

  async delete(member: Member, repositories: Repositories, itemId: string) {
    const { itemLoginSchemaRepository } = repositories;
    return itemLoginSchemaRepository.deleteOne(itemId);
  }
}
