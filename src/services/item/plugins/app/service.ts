import { sign } from 'jsonwebtoken';
import uniqBy from 'lodash.uniqby';
import { singleton } from 'tsyringe';

import { AuthTokenSubject, ItemType, PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item, MinimalAccount } from '../../../../drizzle/types';
import { AuthenticatedUser, MaybeUser } from '../../../../types';
import { APPS_JWT_SECRET } from '../../../../utils/config';
import { AccountRepository } from '../../../account/account.repository';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { PublisherRepository } from './publisherRepository';
import { AppRepository } from './repository';
import { checkTargetItemAndTokenItemMatch } from './utils';

@singleton()
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

  async getMostUsedApps(db: DBConnection, account: AuthenticatedUser) {
    return this.appRepository.getMostUsedApps(db, account.id);
  }

  async getApiAccessToken(
    db: DBConnection,
    actor: MaybeUser,
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
    actor: MaybeUser,
    itemId: string,
    requestDetails?: AuthTokenSubject,
  ) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);
    if (item.type !== ItemType.APP) {
      throw new Error('Item is not an app');
    }

    if (requestDetails) {
      const { itemId: tokenItemId } = requestDetails;
      checkTargetItemAndTokenItemMatch(itemId, tokenItemId);
    }

    // return member data only if authenticated
    let members: MinimalAccount[] = [];
    if (actor) {
      members = await this.getTreeMembers(db, actor, item);
    }

    return { item, members };
  }

  // used in apps: get members from tree
  async getTreeMembers(
    db: DBConnection,
    actor: AuthenticatedUser,
    item: Item,
  ): Promise<MinimalAccount[]> {
    const memberships = await this.itemMembershipRepository.getForManyItems(db, [item]);
    // get members only without duplicate
    return uniqBy(
      memberships.data[item.id].map(({ account }) => account),
      ({ id }: { id: string }) => id,
    );
  }
}
