import { singleton } from 'tsyringe';

import type { DBConnection } from '../../drizzle/db';
import { MaintenanceRepository } from './maintenance.repository';

@singleton()
export class MaintenanceService {
  private maintenanceRepository: MaintenanceRepository;

  constructor(maintenanceRepository: MaintenanceRepository) {
    this.maintenanceRepository = maintenanceRepository;
  }

  /**
   * Returns next maintenance entry, closest to current time
   * @param dbConnection connexion to the database
   * @returns next maintenance entry
   */
  public async getNext(dbConnection: DBConnection) {
    return this.maintenanceRepository.getNext(dbConnection);
  }
}
