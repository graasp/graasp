import { eq } from 'drizzle-orm';

import { DBConnection } from '../drizzle/db';
import { adminsTable } from '../drizzle/schema';

export type AdminUser = typeof adminsTable.$inferSelect;

export class AdminRepository {
  async get(dbConnection: DBConnection, adminId: string): Promise<AdminUser | undefined> {
    const adminUser = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.id, adminId),
    });
    return adminUser;
  }

  async isAdmin(dbConnection, userName): Promise<boolean> {
    const admin = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.userName, userName),
    });
    if (admin) {
      return true;
    }
    return false;
  }
}
