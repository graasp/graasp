import { and, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { AccountType, ResultOf, UUID } from '@graasp/sdk';

import { type DBConnection } from '../../drizzle/db';
import { accountsTable, membersView } from '../../drizzle/schema';
import { AccountInsertDTO, MemberCreationDTO } from '../../drizzle/types';
import { MemberNotFound } from '../../utils/errors';
import { mapById } from '../utils';
import { MemberDTO } from './types';

@singleton()
export class MemberRepository {
  async deleteOne(db: DBConnection, id: string) {
    // need to use the accounts table as we can not delete from a view (membersView)
    await db
      .delete(accountsTable)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.type, AccountType.Individual)));
  }

  async get(db: DBConnection, id: string): Promise<MemberDTO> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new MemberNotFound({ id });
    }
    const m = await db.select().from(membersView).where(eq(membersView.id, id)).limit(1);
    if (!m.length) {
      throw new MemberNotFound({ id });
    }
    return new MemberDTO(m[0]);
  }

  async getMany(db: DBConnection, ids: string[]): Promise<ResultOf<MemberDTO>> {
    const members = await db.select().from(membersView).where(inArray(membersView.id, ids));
    return mapById({
      keys: ids,
      findElement: (id) => {
        const m = members.find(({ id: thisId }) => thisId === id);
        if (m) {
          return new MemberDTO(m);
        }
      },
      buildError: (id) => new MemberNotFound({ id }),
    });
  }

  async getByEmail(db: DBConnection, emailString: string): Promise<MemberDTO | null> {
    const email = emailString.toLowerCase();
    const member = await db.select().from(membersView).where(eq(membersView.email, email));

    if (!member.length) {
      return null;
    }

    return new MemberDTO(member[0]);
  }

  async getManyByEmails(db: DBConnection, emails: string[]): Promise<ResultOf<MemberDTO>> {
    const members = await db.select().from(membersView).where(inArray(membersView.email, emails));
    return mapById({
      keys: emails,
      findElement: (email) => {
        const m = members.find(({ email: thisEmail }) => thisEmail === email);
        if (m) {
          return new MemberDTO(m);
        }
      },
      buildError: (email) => new MemberNotFound({ email }),
    });
  }

  async patch(
    db: DBConnection,
    id: UUID,
    body: Partial<
      Pick<
        AccountInsertDTO,
        'extra' | 'email' | 'name' | 'enableSaveActions' | 'lastAuthenticatedAt' | 'isValidated'
      >
    >,
  ): Promise<MemberDTO> {
    const newData: Partial<AccountInsertDTO> = {};

    if (body.name) {
      newData.name = body.name;
    }

    if (body.email) {
      newData.email = body.email;
    }

    if (body.extra) {
      const [member] = await db.select().from(membersView).where(eq(membersView.id, id)).limit(1);
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
      return new MemberDTO(res[0]);
    }

    return this.get(db, id);
  }

  async post(
    db: DBConnection,
    data: Partial<MemberCreationDTO> & Pick<MemberCreationDTO, 'email' | 'name'>,
  ): Promise<MemberDTO> {
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
    const member = res[0];
    if (member.type !== AccountType.Individual) {
      throw new Error('Expected member to be an individual but was not');
    }
    return new MemberDTO(member);
  }
}
