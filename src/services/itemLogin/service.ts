import { FastifyInstance } from 'fastify';

import { ItemLoginSchemaType, PermissionLevel, UUID } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { ItemService } from '../item/service';
import { Actor, Member } from '../member/entities/member';
import { ItemLoginSchema } from './entities/itemLoginSchema';
import { ValidMemberSession } from './errors';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { encryptPassword, generateRandomEmail } from './utils';

export class ItemLoginService {
  fastify: FastifyInstance;
  private itemService: ItemService;

  constructor(fastify: FastifyInstance, itemService: ItemService) {
    this.fastify = fastify;
    this.itemService = itemService;
  }

  async get(actor: Actor, repositories: Repositories, itemId: string) {
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getForItemPath(item.path, {
      shouldExist: true,
    });
    return itemLoginSchema;
  }

  async getSchemaType(actor: Actor, repositories: Repositories, itemId: string) {
    const item = await repositories.itemRepository.get(itemId);
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getForItemPath(item.path);
    return itemLoginSchema?.type;
  }

  async login(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    credentials: ItemLoginMemberCredentials,
  ) {
    // if there's already a valid session, fail immediately
    if (actor) {
      throw new ValidMemberSession(actor);
    }

    const { username, password } = credentials; // TODO: allow for "empty" username and generate one (anonymous, anonymous+password)
    let bondMember: Member | undefined = undefined;
    if (username) {
      bondMember = await this.loginWithUsername(actor, repositories, itemId, {
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
    actor: Actor,
    repositories: Repositories,
    itemId: UUID,
    { username, password }: { username: string; password?: string },
  ) {
    const { memberRepository, itemLoginRepository, itemRepository, itemLoginSchemaRepository } =
      repositories;

    const item = await itemRepository.get(itemId);

    // initial validation
    // this throws if does not exist
    const itemLoginSchema = (await itemLoginSchemaRepository.getForItemPath(item.path, {
      shouldExist: true,
    })) as ItemLoginSchema;

    const itemLogin = await itemLoginRepository.getForItemAndUsername(item, username);
    let bondMember = itemLogin?.member;

    // reuse existing item login for this user
    if (itemLogin) {
      await itemLoginRepository.validateCredentials(password, itemLogin);
    }
    // create a new item login
    else {
      // create member w/ `username`
      const data: Partial<Member> & Pick<Member, 'email' | 'name'> = {
        name: username,
        email: generateRandomEmail(),
      };

      let encryptedPassword;
      if (password) {
        encryptedPassword = await encryptPassword(password);
      }

      // create account
      bondMember = await memberRepository.post(data);

      // create item login
      await this.linkMember(actor, repositories, itemLoginSchema, bondMember, encryptedPassword);
    }

    return bondMember;
  }

  async put(actor: Member, repositories: Repositories, itemId: string, type?: ItemLoginSchemaType) {
    const { itemLoginSchemaRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return itemLoginSchemaRepository.put(item, type);
  }

  async delete(actor: Member, repositories: Repositories, itemId: string) {
    const { itemLoginSchemaRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Admin);

    return itemLoginSchemaRepository.deleteForItem(item);
  }

  async linkMember(
    actor: Actor,
    repositories: Repositories,
    itemLoginSchema: ItemLoginSchema,
    member: Member,
    password?: string,
  ) {
    const { itemLoginRepository, itemMembershipRepository } = repositories;

    const { item } = itemLoginSchema;

    // bond member to this item
    await itemLoginRepository.post({ itemLoginSchema, member, password });

    // create membership
    await itemMembershipRepository.post({
      item,
      member,
      creator: member,
      permission: PermissionLevel.Read,
    });
  }
}
