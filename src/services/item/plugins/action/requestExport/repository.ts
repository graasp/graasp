import { and, eq, gte } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { ExportActionsFormatting, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { ActionRequestExport, actionRequestExports } from '../../../../../drizzle/schema';
import { IllegalArgumentException } from '../../../../../repositories/errors';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants/constants';

@singleton()
export class ActionRequestExportRepository {
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async addOne(
    db: DBConnection,
    requestExport: Partial<ActionRequestExport>,
  ): Promise<ActionRequestExport> {
    const { memberId, itemPath } = requestExport;
    // expect memberId to be defined
    if (memberId == undefined || memberId == null) {
      throw new IllegalArgumentException('memberId for export request is illegal');
    }
    // expect itemPath to be defined
    if (itemPath == undefined || itemPath == null) {
      throw new IllegalArgumentException('itemPath for export request is illegal');
    }
    const res = await db
      .insert(actionRequestExports)
      .values({
        memberId,
        itemPath,
        // TODO: check that the date can be passed as a string and not as a Date object, otherwise we should call `.toISOString()` on it
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
    db: DBConnection,
    {
      memberId,
      itemPath,
      format,
    }: {
      memberId: UUID;
      itemPath: string;
      format: ExportActionsFormatting;
    },
  ): Promise<ActionRequestExport | undefined> {
    const lowerLimitDate = new Date(Date.now() - DEFAULT_REQUEST_EXPORT_INTERVAL);
    return await db.query.actionRequestExports.findFirst({
      where: and(
        eq(actionRequestExports.memberId, memberId),
        eq(actionRequestExports.itemPath, itemPath),
        eq(actionRequestExports.format, format),
        gte(actionRequestExports.createdAt, lowerLimitDate.toISOString()),
      ),
    });
  }
}
