import { FastifyInstance } from 'fastify';

import { ItemLoginSchemaType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import { Member } from '../member/entities/member';
import { ItemLoginSchema } from './entities/itemLoginSchema';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { encryptPassword, generateRandomEmail } from './util/aux';
import {
  InvalidMember,
  MemberIdentifierNotFound,
  ValidMemberSession,
} from './util/graasp-item-login-error';

export class ItemLoginService {
  fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async get(actor: Member, repositories: Repositories, itemId: string) {
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getForItemPath(item.path);
    return itemLoginSchema;
  }

  async getSchemaType(actor: Member, repositories: Repositories, itemId: string) {
    const item = await repositories.itemRepository.get(itemId);
    // do not need permission to get item login schema
    // we need to know the schema to display the correct form
    const itemLoginSchema = await repositories.itemLoginSchemaRepository.getForItemPath(item.path);
    return itemLoginSchema?.type;
  }

  async login(
    actor: Member,
    repositories: Repositories,
    itemId: string,
    credentials: ItemLoginMemberCredentials,
  ) {
    // if there's already a valid session, fail immediately
    if (actor) {
      throw new ValidMemberSession(actor);
    }

    const { username, memberId, password } = credentials; // TODO: allow for "empty" username and generate one (anonymous, anonymous+password)
    const bondMember = username
      ? await this.loginWithUsername(actor, repositories, itemId, { username, password })
      : await this.loginWithMemberId(actor, repositories, itemId, { memberId, password });

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

  async loginWithUsername(actor, repositories: Repositories, itemId, { username, password }) {
    const { memberRepository, itemLoginRepository, itemRepository, itemLoginSchemaRepository } =
      repositories;

    const item = await itemRepository.get(itemId);

    // initial validation
    const itemLoginSchema = await itemLoginSchemaRepository.getForItemPath(item.path);

    const itemLogin = await itemLoginRepository.getForItemAndUsername(item, username);
    let bondMember = itemLogin?.member;

    // reuse existing item login for this user
    if (itemLogin) {
      await itemLoginRepository.validateCredentials(password, itemLogin);
    }
    // create a new item login
    else {
      // create member w/ `username`
      const data: Partial<Member> = {
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

  async loginWithMemberId(actor, repositories: Repositories, itemId, { memberId, password }) {
    const { memberRepository, itemRepository, itemLoginRepository, itemLoginSchemaRepository } =
      repositories;

    const item = await itemRepository.get(itemId);

    // member w/ `memberId` needs to exist
    const bondMember = await memberRepository.get(memberId);
    if (!bondMember) {
      throw new MemberIdentifierNotFound(memberId);
    }

    // initial validation
    const itemLoginSchema = await itemLoginSchemaRepository.getForItemPath(item.path, {
      shouldExist: true,
    });

    const itemLogin = await itemLoginRepository.getForItemAndMemberId(item, memberId);

    // login user given credentials
    if (itemLogin) {
      await itemLoginRepository.validateCredentials(password, itemLogin);
    } else {
      // TODO
      // possibly using a memberId of a "normally" registered graasp member
      const isGraaspAccount = bondMember;
      if (!isGraaspAccount) {
        throw new InvalidMember(memberId);
      }

      // NECESSARY??
      // await itemLoginRepository.validateCredentials( password, itemLogin);

      await this.linkMember(actor, repositories, itemLoginSchema, bondMember, password);
    }

    return bondMember;
  }

  async put(actor, repositories: Repositories, itemId: string, type?: ItemLoginSchemaType) {
    const { itemRepository, itemLoginSchemaRepository } = repositories;

    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemLoginSchemaRepository.put(item, type);
  }

  async delete(actor, repositories: Repositories, itemId: string) {
    const { itemRepository, itemLoginSchemaRepository } = repositories;

    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemLoginSchemaRepository.deleteForItem(item);
  }

  async linkMember(
    actor,
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
      creator: actor,
      permission: PermissionLevel.Read,
    });
  }
}
