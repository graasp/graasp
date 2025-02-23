import { DBConnection } from '../../../../drizzle/db';
import { ItemMembership } from '../../../../drizzle/schema';
import { MemberIdentifierNotFound } from '../../../itemLogin/errors';

export class ExportDataRepository {
  /**
   * Return all the items where the creator is the given actor.
   * It even returns the item if the actor is the creator but without permissions on it !
   *
   * @param memberId The creator of the items.
   * @returns an array of items created by the actor.
   */
  async getItems(db: DBConnection, memberId: string) {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(itemSchema),
      where: { creator: { id: memberId } },
      order: { updatedAt: 'DESC' },
      relations: {
        creator: true,
      },
    });
  }

  /**
   * Return all the memberships related to the given account.
   * @param accountId ID of the account to retrieve the data.
   * @returns an array of memberships.
   */
  async getItemMemberships(db: DBConnection, accountId: string): Promise<ItemMembership[]> {
    if (!accountId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(itemMembershipSchema),
      where: { account: { id: accountId } },
      order: { updatedAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  }
}
