import { BaseEntity } from 'typeorm';

import { ResultOf } from '@graasp/sdk';

export interface GetAll<T extends BaseEntity> {
  /**
   * Retrieves all the entities.
   * @returns An array containing all the entities.
   */
  getAll(): Promise<T[]>;
}

export interface GetByItem<T extends BaseEntity> {
  /**
   * Retrieves all the entities related to the given item.
   * @param itemId Id of item to retrieve the entities.
   * @returns An array containing all the entities related to the given item.
   */
  getByItem(itemId: string): Promise<T[]>;
}

export interface GetByItems<T extends BaseEntity> {
  /**
   * Retrieves all the entities related to the given item ids.
   * @param itemIds Ids of items to retrieve the entities.
   * @returns An ResultOf containing all the entities related to the given items.
   */
  getByItems(itemIds: string[]): Promise<ResultOf<T[]>>;
}

export interface GetExportByMember<T extends BaseEntity> {
  /**
   * Return all the entities related to the given member.
   * @param memberId ID of the member to retrieve the entities.
   * @returns an array of the entities related to the given member.
   */
  getExportByMember(memberId: string): Promise<T[]>;
}
