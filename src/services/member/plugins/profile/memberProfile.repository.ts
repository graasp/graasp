import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { memberProfilesTable } from '../../../../drizzle/schema';
import { MemberNotFound } from '../../../../utils/errors';
import { MemberProfileCreationError, MemberProfilePropertiesEmpty } from './errors';
import { IMemberProfile } from './types';

@singleton()
export class MemberProfileRepository {
  async createOne(db: DBConnection, memberId: string, payload: Partial<IMemberProfile>) {
    if (Object.values(payload).length === 0) {
      throw new MemberProfilePropertiesEmpty();
    }

    const {
      bio,
      visibility = false,
      facebookId: facebookId,
      linkedinId: linkedinId,
      twitterId: twitterId,
    } = payload;

    const memberProfile = await db
      .insert(memberProfilesTable)
      .values({
        bio,
        visibility,
        facebookId,
        linkedinId,
        twitterId,
        memberId,
      })
      .returning({
        id: memberProfilesTable.id,
        createdAt: memberProfilesTable.createdAt,
        updatedAt: memberProfilesTable.updatedAt,
        visibility: memberProfilesTable.visibility,
        bio: memberProfilesTable.bio,
        twitterId: memberProfilesTable.twitterId,
        facebookId: memberProfilesTable.facebookId,
        linkedinId: memberProfilesTable.linkedinId,
      });
    // ensure there is only a single element
    if (memberProfile.length != 1) {
      throw new MemberProfileCreationError();
    }
    return memberProfile[0];
  }

  async getOwn(db: DBConnection, memberId: string) {
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }
    const memberProfile = await db.query.memberProfilesTable.findFirst({
      where: eq(memberProfilesTable.memberId, memberId),
      with: { member: true },
    });

    return memberProfile;
  }

  async getByMemberId(db: DBConnection, memberId: string, visibility: boolean) {
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }
    const memberProfile = await db.query.memberProfilesTable.findFirst({
      where: and(
        eq(memberProfilesTable.memberId, memberId),
        eq(memberProfilesTable.visibility, visibility),
      ),
      with: { member: true },
    });

    return memberProfile;
  }

  async patch(db: DBConnection, memberId: string, data: Partial<IMemberProfile>) {
    if (Object.values(data).length === 0) {
      throw new MemberProfilePropertiesEmpty();
    }

    return await db
      .update(memberProfilesTable)
      .set(data)
      .where(eq(memberProfilesTable.memberId, memberId));
  }
}
