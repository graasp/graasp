import { PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { validatePermission } from '../authorization';
import ItemService from '../item/service';
import { Actor, Member } from '../member/entities/member';

export class ItemMembershipService {
  itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async create(
    actor: Actor,
    repositories: Repositories,
    im: { permission: PermissionLevel; itemId: string; memberId: string },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository, itemRepository } = repositories;

    const item = await itemRepository.findOneByOrFail({ id: im.itemId });
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);
    const member = await memberRepository.findOneByOrFail({ id: im.memberId });

    return itemMembershipRepository.post({
      item,
      member,
      permission: im.permission,
      creator: actor,
    });
  }

  async get(actor: Actor, repositories: Repositories, id: string) {
    // TODO: check memberships
    const { itemMembershipRepository } = repositories;

    const membership = await itemMembershipRepository.get(id);
    await validatePermission(repositories, PermissionLevel.Read, actor, membership.item);
    return membership;
  }

  async getMany(actor: Actor, repositories: Repositories, ids: string[]) {
    const { itemMembershipRepository } = repositories;
    // TODO: optimize? groupby item?
    // check memberships for all diff items
    const { data, errors } = await itemMembershipRepository.getMany(ids, { throwOnError: true });
    await Promise.all(
      Object.values(data).map(async ({ item }) => {
        try {
          validatePermission(repositories, PermissionLevel.Read, actor, item);
        } catch (e) {
          // if does not have permission, remove data and add error
          delete data.data[item.id];
          errors.push(e);
        }
      }),
    );

    return { data, errors };
  }

  async getForManyItems(actor: Actor, repositories: Repositories, itemIds: string[]) {
    // get memberships, containing item

    const { itemMembershipRepository } = repositories;

    // TODO: handle errors
    const items = await this.itemService.getMany(actor, repositories, itemIds);

    return itemMembershipRepository.getForManyItems(Object.values(items.data));
  }

  async post(actor: Actor, repositories: Repositories, { permission, itemId, memberId }) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository, itemRepository } = repositories;
    // check memberships
    const member = await memberRepository.get(memberId);
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemMembershipRepository.post({ item, member, creator: actor, permission });
  }

  async postMany(
    actor: Actor,
    repositories: Repositories,
    memberships: { permission; memberId }[],
    itemId,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { memberRepository, itemMembershipRepository, itemRepository } = repositories;
    // check memberships
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return Promise.all(
      memberships.map(async ({ memberId, permission }) => {
        const member = await memberRepository.get(memberId);
        return itemMembershipRepository.post({ item, member, creator: actor, permission });
      }),
    );
  }

  async patch(actor: Actor, repositories: Repositories, itemMembershipId: string, data) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemRepository, itemMembershipRepository } = repositories;
    // check memberships
    const iM = await itemMembershipRepository.get(itemMembershipId);
    const item = await itemRepository.get(iM.item.id);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemMembershipRepository.patch(itemMembershipId, data);
  }

  async deleteOne(
    actor: Actor,
    repositories: Repositories,
    itemMembershipId: string,
    args: { purgeBelow?: boolean } = { purgeBelow: false },
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemMembershipRepository } = repositories;
    // TODO: access item?
    // TODO: check memberships
    const { item } = await itemMembershipRepository.get(itemMembershipId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return itemMembershipRepository.deleteOne(itemMembershipId, { purgeBelow: args.purgeBelow });
  }
}

export default ItemMembershipService;
