import { eq, sql } from 'drizzle-orm';

import { DBConnection } from '../../drizzle/db';
import { adminsTable } from '../../drizzle/schema';

export type AdminUser = typeof adminsTable.$inferSelect;
export type AdminUserUpdateData = typeof adminsTable.$inferInsert;

export class AdminRepository {
  async get(dbConnection: DBConnection, adminId: string): Promise<AdminUser | undefined> {
    const adminUser = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.githubId, adminId),
    });
    return adminUser;
  }

  async isAdmin(dbConnection: DBConnection, githubId: string): Promise<boolean> {
    const admin = await dbConnection.query.adminsTable.findFirst({
      where: eq(adminsTable.githubId, githubId),
    });
    if (admin) {
      return true;
    }
    return false;
  }

  async update(
    dbConnection: DBConnection,
    data: { githubId: string; githubName: string },
  ): Promise<AdminUser> {
    const admin = await dbConnection
      .update(adminsTable)
      .set({ githubName: data.githubName, lastAuthenticatedAt: sql`now()` })
      .where(eq(adminsTable.githubId, data.githubId))
      .returning();
    if (!admin || !admin[0]) {
      throw new Error('Could not update admin info');
    }
    return admin[0];
  }
}
