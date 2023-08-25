import uniqBy from 'lodash.uniqby';

import { AuthTokenSubject, ItemType, PermissionLevel, UUID, UnionOfConst } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { Item, isAppItem } from '../../entities/Item';
import { checkTargetItemAndTokenItemMatch } from './utils';

export class AppService {
  jwtExpiration: number;
  promisifiedJwtSign: (
    arg1: { sub: AuthTokenSubject },
    arg2: { expiresIn: string },
  ) => Promise<string>;

  constructor(jwtExpiration, promisifiedJwtSign) {
    this.jwtExpiration = jwtExpiration;
    // this.promisifiedJwtVerify = promisifiedJwtVerify;
    this.promisifiedJwtSign = promisifiedJwtSign;
  }

  async getAllValidAppOrigins(actor: Actor, repositories: Repositories) {
    return repositories.publisherRepository.getAllValidAppOrigins();
  }

  async getAllApps(actor: Actor, repositories: Repositories, publisherId: string) {
    return repositories.appRepository.getAll(publisherId);
  }

  async getApiAccessToken(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    appDetails: { origin: string; key: string },
  ) {
    const { itemRepository, appRepository } = repositories;

    // check item is app
    const item = await itemRepository.get(itemId);
    if (item.type !== ItemType.APP) {
      throw new Error('item is not app'); // TODO
    }

    // check actor has access to item
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    await appRepository.isValidAppOrigin(appDetails);

    const authTokenSubject = appRepository.generateApiAccessTokenSubject(
      actor?.id,
      itemId,
      appDetails,
    );

    const token = await this.promisifiedJwtSign(
      { sub: authTokenSubject },
      { expiresIn: `${this.jwtExpiration}m` },
    );
    return { token };
  }

  async getContext(actorId, repositories: Repositories, itemId: string, requestDetails) {
    const { itemRepository, memberRepository } = repositories;

    const item = await itemRepository.get(itemId);
    if (!isAppItem(item)) {
      throw new Error('Item is not an app');
    }
    const member = actorId ? await memberRepository.get(actorId) : undefined;

    if (requestDetails) {
      const { item: tokenItemId } = requestDetails;
      checkTargetItemAndTokenItemMatch(itemId, tokenItemId);
    }

    await validatePermission(repositories, PermissionLevel.Read, member, item);

    const foldersAndAppItems = await this.getItemsByType(
      actorId,
      repositories,
      [ItemType.FOLDER, ItemType.APP],
      item.path,
    );

    const parent: { children?: Partial<Item>[]; members?: Partial<Member>[] } =
      foldersAndAppItems.length
        ? this.sortedListToTree(foldersAndAppItems[0], foldersAndAppItems, 1)
        : {};

    // return member data only if authenticated
    if (member) {
      const members = await this.getItemAndParentMembers(actorId, repositories, item);
      parent.members = members;
    }

    return { ...item, ...parent };
  }

  // used by app : get tree
  async getItemsByType(
    actorId: UUID,
    repositories: Repositories,
    types: UnionOfConst<typeof ItemType>[],
    path: string,
  ) {
    if (!path.includes('.')) {
      return [];
    }

    return repositories.itemRepository
      .createQueryBuilder('item')
      .where('subpath(:path, 0, -1) @> path', { path })
      .andWhere('type IN (:...types)', { types })
      .orderBy('path', 'ASC')
      .getMany();
  }

  // used in apps: get members from tree
  async getItemAndParentMembers(
    actorId: UUID,
    repositories: Repositories,
    item: Item,
  ): Promise<Member[]> {
    const { path } = item;

    const query = repositories.itemMembershipRepository
      .createQueryBuilder('itemMembership')
      .leftJoinAndSelect('itemMembership.member', 'member')
      .leftJoinAndSelect('itemMembership.item', 'item')
      .where('item.path = :path', { path });

    if (path.includes('.')) {
      query.orWhere('item.path @> subpath(:path, 0, -1)', { path });
    }

    const memberships = await query.getMany();

    // get members only without duplicate
    return uniqBy(
      memberships.map(({ member }) => member),
      ({ id }) => id,
    );
  }

  // TODO: doesn't seem the most performant solution
  private sortedListToTree(
    item: Partial<Item> & { children?: Partial<Item>[] } & Pick<Item, 'type' | 'path'>,
    items: (Partial<Item> & Pick<Item, 'type' | 'path'>)[],
    startAt: number,
  ) {
    const { path, type } = item;
    const level = path.split('.').length;

    if (type !== ItemType.FOLDER) {
      return item;
    }

    item.children = [];

    for (let i = startAt; i < items.length; i++) {
      const nextItem = items[i];
      const nextItemLevel = nextItem.path.split('.').length;

      if (nextItemLevel <= level) break;
      if (nextItemLevel > level + 1) continue;

      item.children.push(this.sortedListToTree(nextItem, items, i + 1));
    }

    return item;
  }
}
