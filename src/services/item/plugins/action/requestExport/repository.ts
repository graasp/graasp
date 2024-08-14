import { EntityManager } from 'typeorm';

import { ExportActionsFormatting, UUID } from '@graasp/sdk';

import { ImmutableRepository } from '../../../../../repositories/ImmutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../../repositories/const';
import { DEFAULT_REQUEST_EXPORT_INTERVAL } from '../../../../action/constants/constants';
import { ActionRequestExport } from './requestExport';

export class ActionRequestExportRepository extends ImmutableRepository<ActionRequestExport> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ActionRequestExport, manager);
  }

  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async addOne(requestExport: Partial<ActionRequestExport>): Promise<ActionRequestExport> {
    return await super.insert({
      member: requestExport.member,
      item: requestExport.item,
      createdAt: requestExport.createdAt,
      format: requestExport.format,
    });
  }

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
  }): Promise<ActionRequestExport | null> {
    const lowerLimitDate = new Date(Date.now() - DEFAULT_REQUEST_EXPORT_INTERVAL);
    return this.repository
      .createQueryBuilder('actionRequestExport')
      .where('actionRequestExport.member_id = :memberId', { memberId })
      .andWhere('actionRequestExport.item_path = :itemPath', { itemPath })
      .andWhere('actionRequestExport.format = :format', { format })
      .andWhere('actionRequestExport.created_at >= :lowerLimitDate', { lowerLimitDate })
      .getOne();
  }
}
