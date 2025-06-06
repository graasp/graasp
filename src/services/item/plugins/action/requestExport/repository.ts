import { and, eq, gte } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { ExportActionsFormatting, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { actionRequestExportsTable } from '../../../../../drizzle/schema';
import type { ActionRequestExportRaw } from '../../../../../drizzle/types';
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
      throw new IllegalArgumentException('memberId for export request is illegal');
    }
    // expect itemPath to be defined
    if (itemPath == undefined || itemPath == null) {
      throw new IllegalArgumentException('itemPath for export request is illegal');
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
      format: ExportActionsFormatting;
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
}
