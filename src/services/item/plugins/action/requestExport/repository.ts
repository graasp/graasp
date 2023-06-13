import { UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants/constants';
import { ActionRequestExport } from './requestExport';

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
    });
  },

  /**
   * Get last request export given item id and member id
   */
  // TODO: what about moving item??
  async getLast({
    memberId,
    itemId,
  }: {
    memberId: UUID;
    itemId: UUID;
  }): Promise<ActionRequestExport> {
    const lowerLimitDate = new Date(Date.now() - DEFAULT_REQUEST_EXPORT_INTERVAL);
    return this.createQueryBuilder('actionRequestExport')
      .where('actionRequestExport.member_id = :memberId', { memberId })
      .where('actionRequestExport.item_id = :memberId', { itemId })
      .where('actionRequestExport.created_at >= :lowerLimitDate', { lowerLimitDate })
      .getOne();
  },
});
