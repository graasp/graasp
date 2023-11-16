import uniqBy from 'lodash.uniqby';

import { AuthTokenSubject, ItemType, PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { Item, isItemType } from '../../entities/Item';
import ItemService from '../../service';
import { checkTargetItemAndTokenItemMatch } from './utils';

export class AppService {
  itemService: ItemService;
  jwtExpiration: number;
  promisifiedJwtSign: (
    arg1: { sub: AuthTokenSubject },
    arg2: { expiresIn: string },
  ) => Promise<string>;

  constructor(itemService, jwtExpiration, promisifiedJwtSign) {
    this.itemService = itemService;
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

  async getContext(
    actorId,
    repositories: Repositories,
    itemId: string,
    requestDetails?: AuthTokenSubject,
  ) {
    const { itemRepository, memberRepository } = repositories;

    const item = await itemRepository.get(itemId);
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
      memberships.data[item.id].map(({ member }) => member),
      ({ id }) => id,
    );
  }
}
