import { sign } from 'jsonwebtoken';
import uniqBy from 'lodash.uniqby';

import { AuthTokenSubject, ItemType, PermissionLevel } from '@graasp/sdk';

import { APPS_JWT_SECRET } from '../../../../utils/config';
import { Repositories } from '../../../../utils/repositories';
import { Account } from '../../../account/entities/account';
import { validatePermission } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { Item, isItemType } from '../../entities/Item';
import { ItemService } from '../../service';
import { checkTargetItemAndTokenItemMatch } from './utils';

export class AppService {
  itemService: ItemService;
  jwtExpiration: number;

  constructor(itemService: ItemService, jwtExpiration: number) {
    this.itemService = itemService;
    this.jwtExpiration = jwtExpiration;
  }

  async getAllValidAppOrigins(repositories: Repositories) {
    return repositories.publisherRepository.getAllValidAppOrigins();
  }

  async getAllApps(repositories: Repositories, publisherId: string) {
    return repositories.appRepository.getAll(publisherId);
  }

  async getMostUsedApps(account: Account, repositories: Repositories) {
    return repositories.appRepository.getMostUsedApps(account.id);
  }

  async getApiAccessToken(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    appDetails: { origin: string; key: string },
  ) {
    const { itemRepository, appRepository } = repositories;

    // check item is app
    const item = await itemRepository.getOneOrThrow(itemId);
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

    const token = sign({ sub: authTokenSubject }, APPS_JWT_SECRET, {
      expiresIn: `${this.jwtExpiration}m`,
    });
    return { token };
  }

  async getContext(
    actorId: string | undefined,
    repositories: Repositories,
    itemId: string,
    requestDetails?: AuthTokenSubject,
  ) {
    const { itemRepository, memberRepository } = repositories;

    const item = await itemRepository.getOneOrThrow(itemId);
    if (!isItemType(item, ItemType.APP)) {
      throw new Error('Item is not an app');
    }
    const member = actorId ? await memberRepository.get(actorId) : undefined;

    if (requestDetails) {
      const { itemId: tokenItemId } = requestDetails;
      checkTargetItemAndTokenItemMatch(itemId, tokenItemId);
    }

    // return member data only if authenticated
    let members: Member[] = [];
    if (member) {
      members = await this.getTreeMembers(member, repositories, item);
    }

    return { item, members };
  }

  // used in apps: get members from tree
  async getTreeMembers(actor: Actor, repositories: Repositories, item: Item): Promise<Member[]> {
    const memberships = await repositories.itemMembershipRepository.getForManyItems([item]);
    // get members only without duplicate
    return uniqBy(
      memberships.data[item.id].map(({ account }) => account),
      ({ id }) => id,
    );
  }
}
