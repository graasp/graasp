import { asc, gte } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import type { DBConnection } from '../../drizzle/db';
import { maintenanceTable } from '../../drizzle/schema';

@singleton()
export class MaintenanceRepository {
  constructor() {}

  /**
   * Returns next maintenance entry, closest to current time
   * @param dbConnection connexion to the database
   * @returns next maintenance entry
   */
  public async getNext(dbConnection: DBConnection) {
    return dbConnection.query.maintenanceTable.findFirst({
      where: gte(maintenanceTable.startAt, new Date().toISOString()),
      orderBy: asc(maintenanceTable.startAt),
    });
  }
}
