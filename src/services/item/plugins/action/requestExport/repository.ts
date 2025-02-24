import { and, eq, gte } from 'drizzle-orm/sql';

import { ExportActionsFormatting, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { actionRequestExports } from '../../../../../drizzle/schema';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants/constants';
import { ActionRequestExport } from './requestExport';

export class ActionRequestExportRepository {
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async addOne(
    db: DBConnection,
    requestExport: Partial<ActionRequestExport>,
  ): Promise<ActionRequestExport> {
    return await db.insert(actionRequestExports).values({
      memberId: requestExport.member.id,
      itemPath: requestExport.item.path,

      // TODO check
      createdAt: requestExport.createdAt?.toISOString(),
      format: requestExport.format,
    });
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
  ): Promise<ActionRequestExport | null> {
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
