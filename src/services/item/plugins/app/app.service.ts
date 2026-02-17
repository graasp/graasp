import { sign } from 'jsonwebtoken';
import uniqBy from 'lodash.uniqby';
import { singleton } from 'tsyringe';

import { type AuthTokenSubject } from '@graasp/sdk';

import { APPS_JWT_SECRET } from '../../../../config/secrets';
import { type DBConnection } from '../../../../drizzle/db';
import type { MinimalAccount } from '../../../../drizzle/types';
import type { AuthenticatedUser, MaybeUser } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { WrongItemTypeError } from '../../errors';
import type { ItemRaw } from '../../item';
import { ItemRepository } from '../../item.repository';
import { AppRepository } from './app.repository';
import { DEFAULT_JWT_EXPIRATION } from './constants';
import { PublisherRepository } from './publisher.repository';
import { checkTargetItemAndTokenItemMatch } from './utils';

@singleton()
export class AppService {
  private readonly jwtExpiration: number;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemRepository: ItemRepository;
  private readonly appRepository: AppRepository;
  private readonly publisherRepository: PublisherRepository;

  constructor(
    authorizedItemService: AuthorizedItemService,
    itemMembershipRepository: ItemMembershipRepository,
    itemRepository: ItemRepository,
    appRepository: AppRepository,
    publisherRepository: PublisherRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.jwtExpiration = DEFAULT_JWT_EXPIRATION;
    this.itemRepository = itemRepository;
    this.appRepository = appRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.publisherRepository = publisherRepository;
  }

  async getAllValidAppOrigins(dbConnection: DBConnection) {
    return this.publisherRepository.getAllValidAppOrigins(dbConnection);
  }

  async getAllApps(dbConnection: DBConnection, publisherId: string) {
    return this.appRepository.getAll(dbConnection, publisherId);
  }

  async getMostUsedApps(dbConnection: DBConnection, account: AuthenticatedUser) {
    return this.appRepository.getMostUsedApps(dbConnection, account.id);
  }

  async getApiAccessToken(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: string,
    appDetails: { origin: string; key: string },
  ) {
    // check actor has access to item
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      permission: 'read',
      accountId: maybeUser?.id,
      itemId,
    });

    // check item is an app
    if (item.type !== 'app') {
      throw new WrongItemTypeError('app');
    }

    await this.appRepository.isValidAppOrigin(dbConnection, appDetails);

    const authTokenSubject = this.appRepository.generateApiAccessTokenSubject(
      maybeUser?.id,
      itemId,
      appDetails,
    );

    const token = sign({ sub: authTokenSubject }, APPS_JWT_SECRET, {
      expiresIn: `${this.jwtExpiration}m`,
    });
    return { token };
  }

  async getContext(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: string,
    requestDetails?: AuthTokenSubject,
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    if (item.type !== 'app') {
      throw new Error('Item is not an app');
    }
    if (requestDetails) {
      const { itemId: tokenItemId } = requestDetails;
      checkTargetItemAndTokenItemMatch(itemId, tokenItemId);
    }

    // return member data only if authenticated
    let members: MinimalAccount[] = [];
    if (actor) {
      members = await this.getTreeMembers(dbConnection, actor, item);
    }

    return { item, members };
  }

  // used in apps: get members from tree
  async getTreeMembers(
    dbConnection: DBConnection,
    actor: AuthenticatedUser,
    item: ItemRaw,
  ): Promise<MinimalAccount[]> {
    const memberships = await this.itemMembershipRepository.getForItem(dbConnection, item);
    // get members only without duplicate
    return uniqBy(
      memberships.map(({ account }) => account),
      ({ id }) => id,
    );
  }
}
