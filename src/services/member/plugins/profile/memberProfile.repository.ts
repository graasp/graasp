import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../../../drizzle/db';
import { memberProfiles } from '../../../../drizzle/schema';
import { MemberNotFound } from '../../../../utils/errors';
import { MemberProfileCreationError } from './errors';
import { IMemberProfile } from './types';

@singleton()
export class MemberProfileRepository {
  async createOne(db: DBConnection, memberId: string, payload: IMemberProfile) {
    const {
      bio,
      visibility = false,
      facebookId: facebookId,
      linkedinId: linkedinId,
      twitterId: twitterId,
    } = payload;

    const memberProfile = await db
      .insert(memberProfiles)
      .values({
        bio,
        visibility,
        facebookId,
        linkedinId,
        twitterId,
        memberId,
      })
      .returning({
        id: memberProfiles.id,
        createdAt: memberProfiles.createdAt,
        updatedAt: memberProfiles.updatedAt,
        visibility: memberProfiles.visibility,
        bio: memberProfiles.bio,
        twitterId: memberProfiles.twitterId,
        facebookId: memberProfiles.facebookId,
        linkedinId: memberProfiles.linkedinId,
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
    const memberProfile = await db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.memberId, memberId),
      with: { member: true },
    });

    return memberProfile;
  }

  async getByMemberId(db: DBConnection, memberId: string, visibility: boolean) {
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }
    const memberProfile = await db.query.memberProfiles.findFirst({
      where: and(eq(memberProfiles.memberId, memberId), eq(memberProfiles.visibility, visibility)),
      with: { member: true },
    });

    return memberProfile;
  }

  async patch(db: DBConnection, memberId: string, data: Partial<IMemberProfile>) {
    return await db.update(memberProfiles).set(data).where(eq(memberProfiles.memberId, memberId));
  }
}
