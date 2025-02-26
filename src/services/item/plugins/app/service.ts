import { sign } from 'jsonwebtoken';
import uniqBy from 'lodash.uniqby';

import { AuthTokenSubject, ItemType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/schema';
import { APPS_JWT_SECRET } from '../../../../utils/config';
import { AccountRepository } from '../../../account/account.repository';
import { Account } from '../../../account/entities/account';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { Actor, Member } from '../../../member/entities/member';
import { isItemType } from '../../entities/Item';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { PublisherRepository } from './publisherRepository';
import { AppRepository } from './repository';
import { checkTargetItemAndTokenItemMatch } from './utils';

export class AppService {
  private readonly itemService: ItemService;
  private readonly jwtExpiration: number;
  private readonly authorizationService: AuthorizationService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemRepository: ItemRepository;
  private readonly appRepository: AppRepository;
  private readonly accountRepository: AccountRepository;
  private readonly publisherRepository: PublisherRepository;

  constructor(
    itemService: ItemService,
    jwtExpiration: number,
    authorizationService: AuthorizationService,
    itemMembershipRepository: ItemMembershipRepository,
    itemRepository: ItemRepository,
    appRepository: AppRepository,
    accountRepository: AccountRepository,
    publisherRepository: PublisherRepository,
  ) {
    this.itemService = itemService;
    this.authorizationService = authorizationService;
    this.jwtExpiration = jwtExpiration;
    this.itemRepository = itemRepository;
    this.appRepository = appRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.accountRepository = accountRepository;
    this.publisherRepository = publisherRepository;
  }

  async getAllValidAppOrigins(db: DBConnection) {
    return this.publisherRepository.getAllValidAppOrigins(db);
  }

  async getAllApps(db: DBConnection, publisherId: string) {
    return this.appRepository.getAll(db, publisherId);
  }

  async getMostUsedApps(db: DBConnection, account: Account) {
    return this.appRepository.getMostUsedApps(db, account.id);
  }

  async getApiAccessToken(
    db: DBConnection,
    actor: Actor,
    itemId: string,
    appDetails: { origin: string; key: string },
  ) {
    // check item is app
    const item = await this.itemRepository.getOneOrThrow(db, itemId);
    if (item.type !== ItemType.APP) {
      throw new Error('item is not app'); // TODO
    }

    // check actor has access to item
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, actor, item);

    await this.appRepository.isValidAppOrigin(db, appDetails);

    const authTokenSubject = this.appRepository.generateApiAccessTokenSubject(
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
    db: DBConnection,
    actorId: string | undefined,
    itemId: string,
    requestDetails?: AuthTokenSubject,
  ) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);
    if (item.type !== ItemType.APP) {
      throw new Error('Item is not an app');
    }
    const account = actorId ? await this.accountRepository.get(db, actorId) : undefined;
    if (requestDetails) {
      const { itemId: tokenItemId } = requestDetails;
      checkTargetItemAndTokenItemMatch(itemId, tokenItemId);
    }

    // return member data only if authenticated
    let members: Member[] = [];
    if (account) {
      members = await this.getTreeMembers(db, account, item);
    }

    return { item, members };
  }

  // used in apps: get members from tree
  async getTreeMembers(db: DBConnection, actor: Actor, item: Item): Promise<Member[]> {
    const memberships = await this.itemMembershipRepository.getForManyItems(db, [item]);
    // get members only without duplicate
    return uniqBy(
      memberships.data[item.id].map(({ account }) => account),
      ({ id }: { id: string }) => id,
    );
  }
}
