import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { EmailFrequency, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app.js';
import { MemberNotFound } from '../../utils/errors.js';
import { MemberRepository } from './repository.js';
import { expectMember, saveMember, saveMembers } from './test/fixtures/members.js';

// mock datasource
jest.mock('../../plugins/datasource');
const memberRepository = new MemberRepository();

const expectMembersById = (members, expectedMembers) => {
  for (const m of members) {
    const expectM = expectedMembers[m.id];
    if (!expectM) {
      throw new Error('expected member should be defined');
    }
    expectMember(expectM, m);
  }
};

describe('MemberRepository', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build());
  });
  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('deleteOne', () => {
    it('delete member', async () => {
      const member = await saveMember();
      expect(await memberRepository.get(member.id)).toBeDefined();

      await memberRepository.deleteOne(member.id);
      expect(memberRepository.get(member.id)).rejects.toBeInstanceOf(MemberNotFound);
    });
    it('silent error if member does not exist', async () => {
      await memberRepository.deleteOne(v4());
    });
  });

  describe('get', () => {
    it('get member', async () => {
      const member = await saveMember();

      const m = await memberRepository.get(member.id);
      expectMember(m, member);
    });

    it('throw for undefined id', async () => {
      expect(memberRepository.get(undefined!)).rejects.toBeInstanceOf(MemberNotFound);
    });

    it('throw for member does not exist', async () => {
      expect(memberRepository.get(v4())).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getMany', () => {
    it('get members', async () => {
      const members = await saveMembers();

      const ms = await memberRepository.getMany(members.map((m) => m.id));
      expectMembersById(members, ms.data);
    });
    it('get members with errors', async () => {
      const members = await saveMembers();

      const errorMemberId = v4();
      const ids = [...members.map((m) => m.id), errorMemberId];
      const ms = await memberRepository.getMany(ids);

      expectMembersById(members, ms.data);
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getByEmail', () => {
    it('get member by email', async () => {
      const member = await saveMember();

      const m = await memberRepository.getByEmail(member.email);
      expectMember(m, member);
    });

    it('throw for undefined email', async () => {
      expect(memberRepository.getByEmail(undefined!)).rejects.toThrow();
    });

    it('return null for unexisting email', async () => {
      expect(await memberRepository.getByEmail('email@email.com')).toBeNull();
    });

    it('throw for unexisting email and shouldExist=true', async () => {
      expect(
        memberRepository.getByEmail('email@email.com', { shouldExist: true }),
      ).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getManyByEmail', () => {
    it('get members by email', async () => {
      const members = await saveMembers();

      const ms = await memberRepository.getManyByEmail(members.map((m) => m.email));

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
      const ms = await memberRepository.getManyByEmail(emails);

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
      const newMember = { name: 'newname', email: 'newemail@email.com' };
      const newM = await memberRepository.patch(member.id, newMember);

      expectMember(newM, { ...member, ...newMember });
    });

    it('patch extra', async () => {
      const member = await saveMember(MemberFactory({ extra: { hasAvatar: true, lang: 'en' } }));
      const extra = { lang: 'fr', emailFreq: EmailFrequency.Never };
      const newM = await memberRepository.patch(member.id, { extra });

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
      const newM = await memberRepository.patch(member.id, newMember);

      expect(newM.enableSaveActions).toBe(false);
    });

    it('does not update for empty new data', async () => {
      const member = await saveMember();
      const newM = await memberRepository.patch(member.id, {});

      expectMember(newM, member);
    });

    it('update unexisting member', async () => {
      const newMember = { enableSaveActions: false };

      expect(memberRepository.patch(v4(), newMember)).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('post', () => {
    it('post member', async () => {
      const newMember = { name: 'newname', email: 'newemail@email.com' };
      const newM = await memberRepository.post(newMember);

      expect(newM.name).toEqual(newMember.name);
      expect(newM.email).toEqual(newMember.email);
      expect(newM.userAgreementsDate.getDate()).toEqual(new Date().getDate());
    });

    it('throw if email already exists', async () => {
      const member = await saveMember();
      expect(memberRepository.post(member)).rejects.toMatchObject({ code: '23505' });
    });
  });
});
