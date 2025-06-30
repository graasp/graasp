import { eq } from 'drizzle-orm';

import { DBConnection } from '../drizzle/db';
import { adminsTable } from '../drizzle/schema';

export type AdminUser = typeof adminsTable.$inferSelect;
export type AdminUserUpdateData = typeof adminsTable.$inferInsert;

export class AdminRepository {
  async get(dbConnection: DBConnection, adminId: string): Promise<AdminUser | undefined> {
    const adminUser = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.id, adminId),
    });
    return adminUser;
  }

  async isAdmin(dbConnection: DBConnection, userName: string): Promise<boolean> {
    const admin = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.userName, userName),
    });
    if (admin) {
      return true;
    }
    return false;
  }

  async update(
    dbConnection: DBConnection,
    userName: string,
    data: { id: string },
  ): Promise<AdminUser> {
    const admin = await dbConnection
      .update(adminsTable)
      .set({ id: data.id })
      .where(eq(adminsTable.userName, userName))
      .returning();
    if (!admin || !admin[0]) {
      throw new Error('Could not update admin info');
    }
    return admin[0];
  }
}
