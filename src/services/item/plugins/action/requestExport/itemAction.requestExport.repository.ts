import { getTableColumns } from 'drizzle-orm';
import { and, eq, gte, or } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { isAncestorOrSelf, isDescendantOrSelf } from '../../../../../drizzle/operations';
import {
  accountsTable,
  actionRequestExportsTable,
  appActionsTable,
  appDataTable,
  appSettingsTable,
  chatMessagesTable,
  itemMembershipsTable,
  itemsRawTable,
} from '../../../../../drizzle/schema';
import {
  type ActionRequestExportFormat,
  type ActionRequestExportRaw,
  type AppActionRaw,
  type AppDataRaw,
  type AppSettingRaw,
  type ChatMessageRaw,
  type ItemMembershipRaw,
  type ItemRaw,
  type MinimalAccount,
} from '../../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../../repositories/errors';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants';

@singleton()
export class ActionRequestExportRepository {
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async addOne(
    dbConnection: DBConnection,
    requestExport: Partial<ActionRequestExportRaw>,
  ): Promise<ActionRequestExportRaw> {
    const { memberId, itemPath } = requestExport;
    // expect memberId to be defined
    if (memberId == undefined || memberId == null) {
      throw new IllegalArgumentException(
        'memberId for export request is required and was not specified',
      );
    }
    // expect itemPath to be defined
    if (itemPath == undefined || itemPath == null) {
      throw new IllegalArgumentException(
        'itemPath for export request is required and was not specified',
      );
    }
    const res = await dbConnection
      .insert(actionRequestExportsTable)
      .values({
        memberId,
        itemPath,
        createdAt: requestExport.createdAt,
        format: requestExport.format,
      })
      .returning();
    return res[0];
  }

  /**
   * Get last request export given item id and member id
   */
  async getLast(
    dbConnection: DBConnection,
    {
      memberId,
      itemPath,
      format,
    }: {
      memberId: UUID;
      itemPath: string;
      format: ActionRequestExportFormat;
    },
  ): Promise<ActionRequestExportRaw | undefined> {
    const lowerLimitDate = new Date(Date.now() - DEFAULT_REQUEST_EXPORT_INTERVAL);
    return await dbConnection.query.actionRequestExportsTable.findFirst({
      where: and(
        eq(actionRequestExportsTable.memberId, memberId),
        eq(actionRequestExportsTable.itemPath, itemPath),
        eq(actionRequestExportsTable.format, format),
        gte(actionRequestExportsTable.createdAt, lowerLimitDate.toISOString()),
      ),
    });
  }

  /**
   * Get accounts who have memberships on tree, from above or below
   * @param dbConnection
   * @param itemPath
   * @returns minimal account data
   */
  public async getAccountsForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<MinimalAccount[]> {
    return await dbConnection
      .selectDistinct({ id: accountsTable.id, name: accountsTable.name })
      .from(itemMembershipsTable)
      .innerJoin(accountsTable, eq(accountsTable.id, itemMembershipsTable.accountId))
      .where(
        and(
          isDescendantOrSelf(itemMembershipsTable.itemPath, itemPath),
          isAncestorOrSelf(itemMembershipsTable.itemPath, itemPath),
        ),
      );
  }

  /**
   * Get all items in tree with given item as root
   * @param dbConnection
   * @param itemPath
   * @returns all items in the tree
   */
  public async getItemTree(dbConnection: DBConnection, itemPath: string): Promise<ItemRaw[]> {
    return await dbConnection
      .select()
      .from(itemsRawTable)
      .where(isDescendantOrSelf(itemsRawTable.path, itemPath));
  }

  /**
   * Get all memberships on the tree, from above or below
   * @param dbConnection
   * @param itemPath
   * @returns
   */
  public async getItemMembershipsForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<ItemMembershipRaw[]> {
    return await dbConnection
      .select()
      .from(itemMembershipsTable)
      .where(
        or(
          isDescendantOrSelf(itemMembershipsTable.itemPath, itemPath),
          isAncestorOrSelf(itemMembershipsTable.itemPath, itemPath),
        ),
      );
  }

  /**
   * Get all chat messages in tree
   * @param dbConnection
   * @param itemPath
   * @returns
   */
  public async getChatMessagesForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<ChatMessageRaw[]> {
    return await dbConnection
      .select(getTableColumns(chatMessagesTable))
      .from(chatMessagesTable)
      .innerJoin(
        itemsRawTable,
        and(
          eq(itemsRawTable.id, chatMessagesTable.itemId),
          isDescendantOrSelf(itemsRawTable.path, itemPath),
        ),
      );
  }

  /**
   * Get all app data in tree
   * @param dbConnection
   * @param itemPath
   * @returns
   */
  public async getAppDataForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<AppDataRaw[]> {
    const appItemsTable = dbConnection
      .select()
      .from(itemsRawTable)
      .where(and(eq(itemsRawTable.type, 'app'), isDescendantOrSelf(itemsRawTable.path, itemPath)))
      .as('app_items');

    return await dbConnection
      .with(appItemsTable)
      .select(getTableColumns(appDataTable))
      .from(appDataTable)
      .innerJoin(appItemsTable, eq(appItemsTable.id, appDataTable.itemId));
  }

  /**
   * Get all app actions in tree
   * @param dbConnection
   * @param itemPath
   * @returns
   */
  public async getAppActionsForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<AppActionRaw[]> {
    const appItemsTable = dbConnection
      .select()
      .from(itemsRawTable)
      .where(and(eq(itemsRawTable.type, 'app'), isDescendantOrSelf(itemsRawTable.path, itemPath)))
      .as('app_items');

    return await dbConnection
      .with(appItemsTable)
      .select(getTableColumns(appActionsTable))
      .from(appActionsTable)
      .innerJoin(appItemsTable, eq(appItemsTable.id, appActionsTable.itemId));
  }

  /**
   * Get all app settings in tree
   * @param dbConnection
   * @param itemPath
   * @returns
   */
  public async getAppSettingsForTree(
    dbConnection: DBConnection,
    itemPath: string,
  ): Promise<AppSettingRaw[]> {
    const appItemsTable = dbConnection
      .select()
      .from(itemsRawTable)
      .where(and(eq(itemsRawTable.type, 'app'), isDescendantOrSelf(itemsRawTable.path, itemPath)))
      .as('app_items');

    return await dbConnection
      .with(appItemsTable)
      .select(getTableColumns(appSettingsTable))
      .from(appSettingsTable)
      .innerJoin(appItemsTable, eq(appItemsTable.id, appSettingsTable.itemId));
  }
}
