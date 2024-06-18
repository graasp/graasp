import { ExportActionsFormatting, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource.js';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants/constants.js';
import { ActionRequestExport } from './requestExport.js';

export const ActionRequestExportRepository = AppDataSource.getRepository(
  ActionRequestExport,
).extend({
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async post(requestExport: Partial<ActionRequestExport>): Promise<ActionRequestExport> {
    return this.save({
      member: requestExport.member,
      item: requestExport.item,
      createdAt: requestExport.createdAt,
      format: requestExport.format,
    });
  },

  /**
   * Get last request export given item id and member id
   */
  async getLast({
    memberId,
    itemPath,
    format,
  }: {
    memberId: UUID;
    itemPath: string;
    format: ExportActionsFormatting;
  }): Promise<ActionRequestExport> {
    const lowerLimitDate = new Date(Date.now() - DEFAULT_REQUEST_EXPORT_INTERVAL);
    return this.createQueryBuilder('actionRequestExport')
      .where('actionRequestExport.member_id = :memberId', { memberId })
      .andWhere('actionRequestExport.item_path = :itemPath', { itemPath })
      .andWhere('actionRequestExport.format = :format', { format })
      .andWhere('actionRequestExport.created_at >= :lowerLimitDate', { lowerLimitDate })
      .getOne();
  },
});
