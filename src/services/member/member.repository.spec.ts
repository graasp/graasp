import { v4 } from 'uuid';
import { describe, expect, it } from 'vitest';

import { EmailFrequency } from '@graasp/sdk';

import { MemberFactory } from '../../../test/factories/member.factory';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import type { MemberRaw } from '../../drizzle/types';
import { MemberNotFound } from '../../utils/errors';
import { MemberRepository } from './member.repository';
import { expectMember } from './test/fixtures/members';
import { MemberDTO } from './types';

const memberRepository = new MemberRepository();

const expectMembersById = (
  result: {
    [key: string]: MemberDTO;
  },
  expectedMembers: MemberRaw[],
) => {
  for (const m of expectedMembers) {
    const expectM = result[m.id];
    if (!expectM) {
      throw new Error('expected member should be defined');
    }
    expectMember(expectM.toCurrent(), m);
  }
};

describe('MemberRepository', () => {
  describe('deleteOne', () => {
    it('delete member', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });
      const expectedMember = await memberRepository.get(db, member.id);
      expect(expectedMember).toBeDefined();

      await memberRepository.deleteOne(db, member.id);

      await expect(async () => await memberRepository.get(db, member.id)).rejects.toThrow(
        new MemberNotFound({ id: member.id }),
      );
    });
    it('silent error if member does not exist', async () => {
      await memberRepository.deleteOne(db, v4());
    });
  });

  describe('get', () => {
    it('get member', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });

      const m = await memberRepository.get(db, member.id);
      expectMember(m.toCurrent(), member);
    });

    it('throw for undefined id', async () => {
      expect(memberRepository.get(db, undefined!)).rejects.toThrow(
        new MemberNotFound({ id: undefined }),
      );
    });

    it('throw for member does not exist', async () => {
      const id = v4();
      expect(memberRepository.get(db, id)).rejects.toThrow(new MemberNotFound({ id }));
    });
  });

  describe('getMany', () => {
    it('get members', async () => {
      const { members } = await seedFromJson({ members: [{}, {}, {}] });

      const ms = await memberRepository.getMany(
        db,
        members.map((m) => m.id),
      );
      expectMembersById(ms.data, members);
    });
    it('get members with errors', async () => {
      const { members } = await seedFromJson({ members: [{}, {}, {}] });

      const errorMemberId = v4();
      const ids = [...members.map((m) => m.id), errorMemberId];
      const ms = await memberRepository.getMany(db, ids);

      expectMembersById(ms.data, members);
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getByEmail', () => {
    it('get member by email', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });

      const m = await memberRepository.getByEmail(db, member.email);
      expectMember(m?.toCurrent(), member);
    });

    it('throw for undefined email', async () => {
      expect(memberRepository.getByEmail(db, undefined!)).rejects.toThrow();
    });

    it('return null for unexisting email', async () => {
      expect(await memberRepository.getByEmail(db, 'email@email.com')).toBeNull();
    });
  });

  describe('getManyByEmail', () => {
    it('get members by email', async () => {
      const { members } = await seedFromJson({ members: [{}, {}, {}] });

      const ms = await memberRepository.getManyByEmails(
        db,
        members.map((m) => m.email),
      );

      for (const m of members) {
        const expectM = ms.data[m.email];
        if (!expectM) {
          throw new Error('expected member should be defined');
        }
        expectMember(expectM.toCurrent(), m);
      }
    });

    it('return error for unexisting email', async () => {
      const { members } = await seedFromJson({ members: [{}] });
      const errorMemberMail = 'email@email.com';

      const emails = [...members.map((m) => m.email), errorMemberMail];
      const ms = await memberRepository.getManyByEmails(db, emails);

      for (const m of members) {
        const expectM = ms.data[m.email];
        if (!expectM) {
          throw new Error('expected member should be defined');
        }
        expectMember(expectM.toCurrent(), m);
      }
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('patch', () => {
    it('patch member', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });
      const randomMember = MemberFactory();
      const newMember = { name: randomMember.name, email: randomMember.email };
      const newM = await memberRepository.patch(db, member.id, newMember);

      expectMember(newM.toCurrent(), { ...member, ...newMember });
    });

    it('patch extra', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{ extra: { hasAvatar: true, lang: 'en' } }, {}] });
      const extra = { lang: 'fr', emailFreq: EmailFrequency.Never };
      const newM = (await memberRepository.patch(db, member.id, { extra })).toCurrent();

      // keep previous extra
      expect(newM.extra.hasAvatar).toBe(true);
      // update previous extra
      expect(newM.extra.lang).toEqual('fr');
      // add new extra
      expect(newM.extra.emailFreq).toEqual(EmailFrequency.Never);
    });

    it('patch enableSaveActions', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });
      const newMember = { enableSaveActions: false };
      const newM = (await memberRepository.patch(db, member.id, newMember)).toCurrent();

      expect(newM.enableSaveActions).toBe(false);
    });

    it('does not update for empty new data', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });
      const newM = await memberRepository.patch(db, member.id, {});

      expectMember(newM.toCurrent(), member);
    });

    it('update unexisting member', async () => {
      const newMember = { enableSaveActions: false };
      const id = v4();
      expect(memberRepository.patch(db, id, newMember)).rejects.toThrow(new MemberNotFound({ id }));
    });
  });

  describe('post', () => {
    it('post member', async () => {
      const newRandomMember = MemberFactory({ name: 'newName' });
      const newMember = { name: newRandomMember.name, email: newRandomMember.email };
      const newM = (await memberRepository.post(db, newMember)).toCurrent();

      expect(newM.name).toEqual(newMember.name);
      // Important: The email will be lowercased by the service
      expect(newM.email).toEqual(newMember.email.toLowerCase());
      expect(newM.userAgreementsDate).toBeDefined();
      expect(new Date(newM.userAgreementsDate!).getDate()).toEqual(new Date().getDate());
    });

    it('throw if email already exists', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });
      await expect(async () => await memberRepository.post(db, member)).rejects.toThrow(
        expect.objectContaining(
          new Error(expect.stringContaining('duplicate key value violates unique constraint')),
        ),
      );
    });
  });
});
