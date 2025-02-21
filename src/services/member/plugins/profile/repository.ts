import { and, eq, inArray } from 'drizzle-orm/sql';
import { v4 } from 'uuid';

import { DBConnection } from '../../../../drizzle/db';
import { memberProfiles } from '../../../../drizzle/schema';
import { MemberNotFound } from '../../../../utils/errors';
import { IMemberProfile } from './types';

class MemberProfileRepository {
  async createOne(db: DBConnection, memberId: string, payload: IMemberProfile) {
    const {
      bio,
      visibility = false,
      facebookID: facebookId,
      linkedinID: linkedinId,
      twitterID: twitterId,
    } = payload;

    const memberProfile = await db.insert(memberProfiles).values({
      bio,
      visibility,
      facebookId,
      linkedinId,
      twitterId,
      memberId,
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
    return db.update(memberProfiles).set(data).where(eq(memberProfiles.memberId, memberId));
  }
}

export default MemberProfileRepository;
