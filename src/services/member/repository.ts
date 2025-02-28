import { and, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { AccountType, UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import {
  AccountCreationDTO,
  MemberCreationDTO,
  accountsTable,
  membersView,
} from '../../drizzle/schema';
import { MemberNotFound } from '../../utils/errors';
import { mapById } from '../utils';

@singleton()
export class MemberRepository {
  async deleteOne(db: DBConnection, id: string) {
    // need to use the accounts table as we can not delete from a view (membersView)
    await db
      .delete(accountsTable)
      .where(
        and(
          eq(accountsTable.id, id),
          eq(accountsTable.type, AccountType.Individual),
        ),
      );
  }

  async get(db: DBConnection, id: string) {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new MemberNotFound({ id });
    }
    const m = await db
      .select()
      .from(membersView)
      .where(eq(membersView.id, id))
      .limit(1);
    if (!m.length) {
      throw new MemberNotFound({ id });
    }
    return m[0];
  }

  async getMany(db: DBConnection, ids: string[]) {
    const members = await db
      .select()
      .from(membersView)
      .where(inArray(membersView.id, ids));
    return mapById({
      keys: ids,
      findElement: (id) => members.find(({ id: thisId }) => thisId === id),
      buildError: (id) => new MemberNotFound({ id }),
    });
  }

  async getByEmail(
    db: DBConnection,
    emailString: string,
    args: { shouldExist?: boolean } = {},
  ) {
    const email = emailString.toLowerCase();
    const member = await db
      .select()
      .from(membersView)
      .where(eq(membersView.email, email));

    if (args.shouldExist) {
      if (member.length != 1) {
        throw new MemberNotFound({ email });
      }
    }
    return member.at(0);
  }

  async getManyByEmails(db: DBConnection, emails: string[]) {
    const members = await db
      .select()
      .from(membersView)
      .where(inArray(membersView.email, emails));
    return mapById({
      keys: emails,
      findElement: (email) =>
        members.find(({ email: thisEmail }) => thisEmail === email),
      buildError: (email) => new MemberNotFound({ email }),
    });
  }

  async patch(
    db: DBConnection,
    id: UUID,
    body: Partial<
      Pick<
        AccountCreationDTO,
        | 'extra'
        | 'email'
        | 'name'
        | 'enableSaveActions'
        | 'lastAuthenticatedAt'
        | 'isValidated'
      >
    >,
  ) {
    const newData: Partial<AccountCreationDTO> = {};

    if (body.name) {
      newData.name = body.name;
    }

    if (body.email) {
      newData.email = body.email;
    }

    if (body.extra) {
      const member = await this.get(db, id);
      newData.extra = Object.assign({}, member.extra, body?.extra);
    }

    if (typeof body.enableSaveActions === 'boolean') {
      newData.enableSaveActions = body.enableSaveActions;
    }

    if (body.lastAuthenticatedAt) {
      newData.lastAuthenticatedAt = body.lastAuthenticatedAt;
    }

    if (typeof body.isValidated === 'boolean') {
      newData.isValidated = body.isValidated;
    }

    // update if newData is not empty
    if (Object.keys(newData).length) {
      // TODO: check member exists
      const res = await db
        .update(accountsTable)
        .set(newData)
        .where(eq(accountsTable.id, id))
        .returning();
      if (res.length != 1) {
        throw new MemberNotFound({ id });
      }
      return res[0];
    }

    return this.get(db, id);
  }

  async post(
    db: DBConnection,
    data: Partial<MemberCreationDTO> &
      Pick<MemberCreationDTO, 'email' | 'name'>,
  ) {
    const email = data.email.toLowerCase();

    // The backend assumes user agrees to terms by creating an account.
    // The auth frontend only blocks the user to create an account without checking the boxes.
    // The frontend avoids sending agreement data to prevent manipulation of the agreement date.
    // The agreements links are included in the registration email as a reminder.
    const userAgreementsDate = new Date().toISOString();
    const res = await db
      .insert(accountsTable)
      .values({
        ...data,
        email,
        userAgreementsDate,
      })
      .returning();
    if (res.length != 1) {
      throw new Error('could not get added member');
    }
    return res[0];
  }
}
