import { v4 } from 'uuid';

import { EmailFrequency, MemberFactory } from '@graasp/sdk';

import { client, db } from '../../drizzle/db';
import { MemberRaw } from '../../drizzle/types';
import { MemberNotFound } from '../../utils/errors';
import { MemberRepository } from './member.repository';
import { expectMember, saveMember, saveMembers } from './test/fixtures/members';

const memberRepository = new MemberRepository();

const expectMembersById = (
  members: MemberRaw[],
  expectedMembers: {
    [key: string]: MemberRaw;
  },
) => {
  for (const m of members) {
    const expectM = expectedMembers[m.id];
    if (!expectM) {
      throw new Error('expected member should be defined');
    }
    expectMember(expectM, m);
  }
};

describe('MemberRepository', () => {
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  describe('deleteOne', () => {
    it('delete member', async () => {
      const member = await saveMember();
      expect(await memberRepository.get(db, member.id)).toBeDefined();

      await memberRepository.deleteOne(db, member.id);
      expect(memberRepository.get(db, member.id)).rejects.toBeInstanceOf(MemberNotFound);
    });
    it('silent error if member does not exist', async () => {
      await memberRepository.deleteOne(db, v4());
    });
  });

  describe('get', () => {
    it('get member', async () => {
      const member = await saveMember();

      const m = await memberRepository.get(db, member.id);
      expectMember(m, member);
    });

    it('throw for undefined id', async () => {
      expect(memberRepository.get(db, undefined!)).rejects.toBeInstanceOf(MemberNotFound);
    });

    it('throw for member does not exist', async () => {
      expect(memberRepository.get(db, v4())).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getMany', () => {
    it('get members', async () => {
      const members = await saveMembers();

      const ms = await memberRepository.getMany(
        db,
        members.map((m) => m.id),
      );
      expectMembersById(members, ms.data);
    });
    it('get members with errors', async () => {
      const members = await saveMembers();

      const errorMemberId = v4();
      const ids = [...members.map((m) => m.id), errorMemberId];
      const ms = await memberRepository.getMany(db, ids);

      expectMembersById(members, ms.data);
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getByEmail', () => {
    it('get member by email', async () => {
      const member = await saveMember();

      const m = await memberRepository.getByEmail(db, member.email);
      expectMember(m, member);
    });

    it('throw for undefined email', async () => {
      expect(memberRepository.getByEmail(db, undefined!)).rejects.toThrow();
    });

    it('return null for unexisting email', async () => {
      expect(await memberRepository.getByEmail(db, 'email@email.com')).toBeUndefined();
    });

    it('throw for unexisting email and shouldExist=true', async () => {
      expect(
        memberRepository.getByEmail(db, 'email@email.com', { shouldExist: true }),
      ).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getManyByEmail', () => {
    it('get members by email', async () => {
      const members = await saveMembers();

      const ms = await memberRepository.getManyByEmails(
        db,
        members.map((m) => m.email),
      );

      for (const m of members) {
        const expectM = ms.data[m.email];
        if (!expectM) {
          throw new Error('expected member should be defined');
        }
        expectMember(expectM, m);
      }
    });

    it('return error for unexisting email', async () => {
      const members = await saveMembers();
      const errorMemberMail = 'email@email.com';

      const emails = [...members.map((m) => m.email), errorMemberMail];
      const ms = await memberRepository.getManyByEmails(db, emails);

      for (const m of members) {
        const expectM = ms.data[m.email];
        if (!expectM) {
          throw new Error('expected member should be defined');
        }
        expectMember(expectM, m);
      }
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('patch', () => {
    it('patch member', async () => {
      const member = await saveMember();
      const randomMember = MemberFactory();
      const newMember = { name: randomMember.name, email: randomMember.email };
      const newM = await memberRepository.patch(db, member.id, newMember);

      expectMember(newM, { ...member, ...newMember });
    });

    it('patch extra', async () => {
      const member = await saveMember(MemberFactory({ extra: { hasAvatar: true, lang: 'en' } }));
      const extra = { lang: 'fr', emailFreq: EmailFrequency.Never };
      const newM = await memberRepository.patch(db, member.id, { extra });

      // keep previous extra
      expect(newM.extra.hasAvatar).toBe(true);
      // update previous extra
      expect(newM.extra.lang).toEqual('fr');
      // add new extra
      expect(newM.extra.emailFreq).toEqual(EmailFrequency.Never);
    });

    it('patch enableSaveActions', async () => {
      const member = await saveMember();
      const newMember = { enableSaveActions: false };
      const newM = await memberRepository.patch(db, member.id, newMember);

      expect(newM.enableSaveActions).toBe(false);
    });

    it('does not update for empty new data', async () => {
      const member = await saveMember();
      const newM = await memberRepository.patch(db, member.id, {});

      expectMember(newM, member);
    });

    it('update unexisting member', async () => {
      const newMember = { enableSaveActions: false };

      expect(memberRepository.patch(db, v4(), newMember)).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('post', () => {
    it('post member', async () => {
      const newRandomMember = MemberFactory({ name: 'newName' });
      const newMember = { name: newRandomMember.name, email: newRandomMember.email };
      const newM = await memberRepository.post(db, newMember);

      expect(newM.name).toEqual(newMember.name);
      // Important: The email will be lowercased by the service
      expect(newM.email).toEqual(newMember.email.toLowerCase());
      expect(newM.userAgreementsDate).toBeDefined();
      expect(new Date(newM.userAgreementsDate!).getDate()).toEqual(new Date().getDate());
    });

    it('throw if email already exists', async () => {
      const member = await saveMember();
      expect(memberRepository.post(db, member)).rejects.toMatchObject({ code: '23505' });
    });
  });
});
