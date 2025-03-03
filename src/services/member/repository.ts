import { and, eq, inArray } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { AccountType, CompleteMember, UUID } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { DBConnection } from '../../drizzle/db';
import { accountsTable, membersView } from '../../drizzle/schema';
import { AccountInsertDTO, MemberCreationDTO } from '../../drizzle/types';
import { MaybeUser, MemberInfo, MinimalMember } from '../../types';
import { MemberNotFound } from '../../utils/errors';
import { mapById } from '../utils';

export type Member = {
  id: string;
  name: string;
};

// TODO: move the member extra type here, so we have control over it
type MemberExtra = CompleteMember['extra'];

export type CurrentMember = {
  id: string;
  name: string;
  email: string;
  type: AccountType.Individual;
  isValidated: boolean;
  lang: string;
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string | null;
  userAgreementsDate: string | null;
  extra: MemberExtra;
  enableSaveActions: boolean;
  // add any necessary properties here
};

type PublicMember = {
  id: string;
  name: string;
  // TODO: this should be removed as soon as possible as we do not want to leak such info.
  email: string;
};

type MemberInput = typeof membersView.$inferSelect;

export class MemberDTO {
  private readonly member: MemberInput;

  constructor(member: MemberInput) {
    this.member = member;
  }

  get id() {
    return this.member.id;
  }

  get email() {
    // HACK: This should be removed when we make the member email be non-nullable
    if (!this.member.email) {
      throw new Error(
        'member should have defined email, expected to have defined, found undefined',
      );
    }
    return this.member.email;
  }

  toMaybeUser(): MaybeUser {
    return this.toMinimal();
  }

  toMinimal(): MinimalMember {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
    };
  }

  toMemberInfo(): MemberInfo {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
      // HACK: email should always exist but the columns is not marked as nonNull
      email: this.member.email!,
      lang: this.member.extra.lang ?? DEFAULT_LANG,
    };
  }

  toCurrent(): CurrentMember {
    return {
      id: this.member.id,
      name: this.member.name,
      type: AccountType.Individual,
      isValidated: this.member.isValidated ?? false,
      // HACK: email should always exist but the columns is not marked as nonNull
      email: this.member.email!,
      lang: this.member.extra.lang ?? DEFAULT_LANG,
      createdAt: this.member.createdAt,
      updatedAt: this.member.updatedAt,
      lastAuthenticatedAt: this.member.lastAuthenticatedAt,
      userAgreementsDate: this.member.userAgreementsDate,
      extra: this.member.extra,
      // TODO: what should be the default for this ? Why could it be null ? can we enforce a value ??
      enableSaveActions: this.member.enableSaveActions ?? true,
    };
  }

  toPublicMember(): PublicMember {
    return {
      id: this.member.id,
      name: this.member.name,
      email: this.email,
    };
  }
}

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

  async get(db: DBConnection, id: string): Promise<MemberDTO> {
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
    return new MemberDTO(m[0]);
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
      if (member.length !== 1) {
        throw new MemberNotFound({ email });
      }
    }
    return new MemberDTO(member[0]);
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
        AccountInsertDTO,
        | 'extra'
        | 'email'
        | 'name'
        | 'enableSaveActions'
        | 'lastAuthenticatedAt'
        | 'isValidated'
      >
    >,
  ) {
    const newData: Partial<AccountInsertDTO> = {};

    if (body.name) {
      newData.name = body.name;
    }

    if (body.email) {
      newData.email = body.email;
    }

    if (body.extra) {
      const [member] = await db
        .select()
        .from(membersView)
        .where(eq(membersView.id, id))
        .limit(1);
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
    const member = res[0];
    if (member.type !== AccountType.Individual) {
      throw new Error('Expected member to be an individual but was not');
    }
    return new MemberDTO(member);
  }
}
