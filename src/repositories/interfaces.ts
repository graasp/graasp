import { BaseEntity } from 'typeorm';

export interface GetAll<T extends BaseEntity> {
  /**
   * Retrieves all the entities.
   * @returns An array containing all the entities.
   */
  getAll(): Promise<T[]>;
}
