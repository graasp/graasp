import { add, isBefore } from 'date-fns';
import { inject, singleton } from 'tsyringe';
import { v4 } from 'uuid';

import Etherpad, { type AuthorSession } from '@graasp/etherpad-api';
import {
  type EtherpadItemExtra,
  EtherpadPermission,
  type EtherpadPermissionType,
} from '@graasp/sdk';

import { ETHERPAD_NAME_FACTORY_DI_KEY } from '../../../../di/constants';
import { type DBConnection } from '../../../../drizzle/db';
import type { ItemRaw, MinimalAccount } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import type {
  AuthenticatedUser,
  MaybeUser,
  MinimalMember,
} from '../../../../types';
import { MemberCannotWriteItem } from '../../../../utils/errors';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { type EtherpadItem, isItemType } from '../../discrimination';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { MAX_SESSIONS_IN_COOKIE, PLUGIN_NAME } from './constants';
import { EtherpadServerError, ItemMissingExtraError } from './errors';
import { EtherpadServiceConfig } from './serviceConfig';
import { type PadNameFactory } from './types';

export class RandomPadNameFactory implements PadNameFactory {
  public getName() {
    return v4();
  }
}

/**
 * Handles interactions between items and the remote Etherpad service
 * Exposes API to manage etherpad items inside Graasp
 */
@singleton()
export class EtherpadItemService {
  public readonly api: Etherpad;
  private readonly padNameFactory: PadNameFactory;
  private readonly publicUrl: string;
  private readonly cookieDomain: string;
  private readonly itemService: ItemService;
  private readonly itemRepository: ItemRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly log: BaseLogger;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    etherpad: Etherpad,
    @inject(ETHERPAD_NAME_FACTORY_DI_KEY) padNameFactory: PadNameFactory,
    etherPadConfig: EtherpadServiceConfig,
    itemService: ItemService,
    itemRepository: ItemRepository,
    itemMembershipRepository: ItemMembershipRepository,
    log: BaseLogger,
    authorizedItemService: AuthorizedItemService,
  ) {
    this.api = etherpad;
    this.padNameFactory = padNameFactory;
    this.publicUrl = etherPadConfig.publicUrl;
    this.cookieDomain = etherPadConfig.cookieDomain;
    this.itemService = itemService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemRepository = itemRepository;
    this.log = log;
    this.authorizedItemService = authorizedItemService;
  }

  /**
   * Creates a new standalone pad in Etherpad service
   */
  private async createPad(
    options:
      | { action: 'create'; initHtml?: string }
      | { action: 'copy'; sourceID: string },
  ) {
    // new pad name
    const padName = this.padNameFactory.getName();

    // map pad to a group containing only itself
    const { groupID } = await this.api.createGroupIfNotExistsFor({
      groupMapper: `${padName}`,
    });

    switch (options.action) {
      case 'create':
        await this.api.createGroupPad({ groupID, padName });
        if (options.initHtml) {
          const padID = this.buildPadID({ groupID, padName });
          const { initHtml: html } = options;
          await this.api.setHTML({ padID, html });
        }
        break;
      case 'copy':
        const { sourceID } = options;
        await this.api.copyPad({
          sourceID,
          destinationID: this.buildPadID({ groupID, padName }),
        });
        break;
    }

    return { groupID, padName };
  }

  /**
   * Creates a new Etherpad item linked to a pad in the service
   */
  public async createEtherpadItem(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: { readerPermission?: EtherpadPermissionType; name: string },
    parentId?: string,
    initHtml?: string,
  ) {
    const { groupID, padName } = await this.createPad({
      action: 'create',
      initHtml,
    });

    try {
      return this.itemService.post(dbConnection, member, {
        item: {
          name: args.name,
          type: 'etherpad',
          extra: this.buildEtherpadExtra({
            groupID,
            padName,
            readerPermission: args.readerPermission ?? EtherpadPermission.Read,
          }),
        },
        parentId,
      });
    } catch (error) {
      // create item failed, delete created pad
      const padID = this.buildPadID({ groupID, padName });
      this.api
        .deletePad({ padID })
        .catch((e) =>
          this.log.error(
            `${PLUGIN_NAME}: failed to delete orphan etherpad ${padID} because of ${e.message}`,
          ),
        );
      throw error;
    }
  }

  /**
   * Updates Etherpad item
   */
  public async patchWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    body: Partial<Pick<ItemRaw, 'settings' | 'name' | 'lang'>> & {
      readerPermission?: EtherpadPermissionType;
    },
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is link
    if (!isItemType(item, 'etherpad')) {
      throw new WrongItemTypeError(item.type);
    }

    const { readerPermission: newReaderPermissionValue, ...itemProps } = body;

    const newProps: Partial<EtherpadItem> = { ...itemProps };
    // patch extra only if has changes
    if (newReaderPermissionValue) {
      newProps.extra = {
        ['etherpad']: {
          ...item.extra.etherpad,
          // use new value, previously set value, or default 'read'
          readerPermission:
            newReaderPermissionValue ??
            item.extra.etherpad.readerPermission ??
            EtherpadPermission.Read,
        },
      };
    }

    return this.itemService.patch(dbConnection, member, itemId, newProps);
  }

  /**
   * Helper to determine the final viewing mode of an etherpad
   */
  private async checkMode(
    dbConnection: DBConnection,
    requestedMode: 'read' | 'write',
    account: MinimalAccount,
    item: EtherpadItem,
  ): Promise<'read' | 'write'> {
    // no specific check if read mode was requested
    if (requestedMode === 'read') {
      return 'read';
    }
    // if mode was write,
    // check that permission is at least write

    const membership = await this.itemMembershipRepository.getInherited(
      dbConnection,
      item.path,
      account.id,
      true,
    );
    // allow write for admin, writers, and readers if setting is enabled
    if (
      membership &&
      (membership.permission == 'write' ||
        membership.permission == 'admin' ||
        (membership.permission == 'read' &&
          item.extra.etherpad.readerPermission == 'write'))
    ) {
      return 'write';
    }
    return 'read';
  }
  catch(error: unknown) {
    // something else failed in the authorization
    if (!(error instanceof MemberCannotWriteItem)) {
      throw error;
    }
    // the user simply does not have write permission, so fallback to read
    return 'read';
  }

  /**
   * Retrieves the Etherpad service URL of the requested pad for a given item and a cookie
   * containing all valid sessions for pads for a given member (including the requested pad)
   */
  public async getEtherpadFromItem(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    mode: 'read' | 'write',
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: account.id,
      itemId,
    });

    if (!isItemType(item, 'etherpad') || !item.extra?.etherpad) {
      throw new ItemMissingExtraError(item?.id);
    }

    const checkedMode = await this.checkMode(dbConnection, mode, account, item);

    const { padID, groupID } = item.extra.etherpad;

    let padUrl: string;
    switch (checkedMode) {
      case 'read': {
        const readOnlyResult = await this.api.getReadOnlyID({ padID });
        if (!readOnlyResult) {
          throw new EtherpadServerError(
            `No readOnlyID returned for padID ${padID}`,
          );
        }
        const { readOnlyID } = readOnlyResult;
        padUrl = this.buildPadPath({ padID: readOnlyID }, this.publicUrl);
        break;
      }
      case 'write': {
        padUrl = this.buildPadPath({ padID }, this.publicUrl);
        break;
      }
    }

    // map user to etherpad author
    const { authorID } = await this.api.createAuthorIfNotExistsFor({
      authorMapper: account.id,
      name: account.name,
    });

    // start session for user on the group
    const expiration = add(new Date(), { days: 1 });
    const sessionResult = await this.api.createSession({
      authorID,
      groupID,
      validUntil: expiration.getTime() / 1000,
    });
    if (!sessionResult) {
      throw new EtherpadServerError(
        `No session created for authorID ${authorID} on group ${groupID}`,
      );
    }
    const { sessionID } = sessionResult;

    // get available sessions for user
    const sessions = (await this.api.listSessionsOfAuthor({ authorID })) ?? {};

    // split valid from expired sessions
    const now = new Date();
    const { valid, expired } = Object.entries(sessions).reduce(
      ({ valid, expired }, [id, session]) => {
        const validUntil = session?.validUntil;
        if (!validUntil) {
          // edge case: some old sessions may be null, or not have an expiration set
          // delete malformed session anyway
          expired.add(id);
        } else {
          // normal case: check if session is expired
          // Date takes miliseconds but the etherpads deals with seconds
          const isExpired = isBefore(new Date(validUntil * 1000), now);
          if (isExpired) {
            expired.add(id);
          } else {
            valid.add(id);
          }
        }
        return { valid, expired };
      },
      {
        valid: new Set<string>(),
        expired: new Set<string>(),
      },
    );
    // sanity check, add the new sessionID (should already be part of the set)
    valid.add(sessionID);

    // in practice, there is (probably) a limit of 1024B per cookie value
    // https://chromestatus.com/feature/4946713618939904
    // so we can only store up to limit / (size of sessionID string + ",")
    // assuming that no other cookies are set on the etherpad domain
    // to err on the cautious side, we invalidate the oldest cookies in this case
    if (valid.size > MAX_SESSIONS_IN_COOKIE) {
      const sortedRecent = Array.from(valid).sort((a, b) => {
        // we are guaranteed that a, b index valid sessions from above
        const timeA =
          new Date((sessions[a] as AuthorSession).validUntil).getTime() / 1000;
        const timeB =
          new Date((sessions[b] as AuthorSession).validUntil).getTime() / 1000;
        // return inversed for most recent
        if (timeA < timeB) {
          return 1;
        }
        if (timeA > timeB) {
          return -1;
        }
        return 0;
      });

      const toInvalidate = sortedRecent.slice(MAX_SESSIONS_IN_COOKIE);

      // mutate valid and expired sets in place
      toInvalidate.forEach((id) => {
        valid.delete(id);
        expired.add(id);
      });
    }

    // delete expired cookies asynchronously in the background, accept failures by catching
    expired.forEach((sessionID) => {
      this.api
        .deleteSession({ sessionID })
        .catch((e) =>
          this.log.error(
            `${PLUGIN_NAME}: failed to delete etherpad session ${sessionID}, because ${e.message}`,
          ),
        );
    });

    // set cookie with all valid cookies (users should be able to access multiple etherpads simultaneously)
    const cookie = {
      name: 'sessionID',
      value: Array.from(valid).join(','),
      options: {
        domain: this.cookieDomain,
        path: '/',
        expires: expiration,
        signed: false,
        httpOnly: false, // cookie must be available to Etherpad's JS code for it to work!
      },
    };

    return { padUrl, cookie };
  }

  /**
   * Retrieves the Etherpad html content for a given item
   * useful for exporting data
   *
   * @param {MaybeUser} account user retrieving the content
   * @param {string} itemId item to retrieve the content of
   * @returns {string} html content of the etherpad
   */
  public async getEtherpadContentFromItem(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: string,
  ): Promise<string> {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    if (!isItemType(item, 'etherpad') || !item.extra?.etherpad) {
      throw new ItemMissingExtraError(item?.id);
    }

    const { padID } = item.extra.etherpad;

    return (await this.api.getHTML({ padID })).html;
  }

  /**
   * Deletes an Etherpad associated to an item
   */
  public async deleteEtherpadForItem(item: ItemRaw) {
    if (!isItemType(item, 'etherpad')) {
      return;
    }

    const extra = item?.extra?.etherpad;
    if (!extra?.padID) {
      throw new Error(
        `Illegal state: property padID is missing in etherpad extra for item ${item.id}`,
      );
    }
    const { padID } = extra;

    await this.api.deletePad({ padID });
  }

  /**
   * Copies an Etherpad for an associated copied mutable item
   */
  public async copyEtherpadInMutableItem(item: ItemRaw) {
    if (!isItemType(item, 'etherpad')) {
      return;
    }

    const extra = item?.extra?.etherpad;
    if (!extra?.padID) {
      throw new Error(
        `Illegal state: property padID is missing in etherpad extra for item ${item.id}`,
      );
    }
    const { padID } = extra;

    const { groupID, padName } = await this.createPad({
      action: 'copy',
      sourceID: padID,
    });
    // assign pad copy to new item's extra
    item.extra = this.buildEtherpadExtra({ groupID, padName });
  }

  /**
   * Builds a group pad ID
   * https://etherpad.org/doc/v1.8.18/#index_pad
   */
  static buildPadID({
    groupID,
    padName,
  }: {
    groupID: string;
    padName: string;
  }) {
    return `${groupID}$${padName}`;
  }
  buildPadID = EtherpadItemService.buildPadID;

  /**
   * Builds an Etherpad path to the given pad
   * https://etherpad.org/doc/v1.8.18/#index_embed-parameters
   * @param baseUrl if specified, will return the absolute url to the pad, otherwise the relative path will be given
   */
  static buildPadPath({ padID }: { padID: string }, baseUrl?: string) {
    const path = `/p/${padID}`;
    return baseUrl ? new URL(path, baseUrl).toString() : path;
  }
  buildPadPath = EtherpadItemService.buildPadPath;

  /**
   * Builds an Etherpad extra for Item
   */
  static buildEtherpadExtra({
    groupID,
    padName,
    readerPermission = EtherpadPermission.Read,
  }: {
    groupID: string;
    padName: string;
    readerPermission?: EtherpadPermissionType;
  }): EtherpadItemExtra {
    return {
      etherpad: {
        padID: this.buildPadID({ groupID, padName }),
        groupID,
        readerPermission,
      },
    };
  }
  buildEtherpadExtra = EtherpadItemService.buildEtherpadExtra;
}
