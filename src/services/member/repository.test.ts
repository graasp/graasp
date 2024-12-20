import { faker } from '@faker-js/faker';
import { DataSource, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { EmailFrequency, MemberFactory } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberNotFound } from '../../utils/errors';
import { Member } from './entities/member';
import { MemberRepository } from './repository';
import { expectMember } from './test/fixtures/members';

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
  let db: DataSource;

  let repository: MemberRepository;
  let rawRepository: Repository<Member>;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new MemberRepository(db.manager);
    rawRepository = db.getRepository(Member);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('deleteOne', () => {
    it('delete member', async () => {
      const member = await rawRepository.save(MemberFactory());
      expect(await repository.get(member.id)).toBeDefined();

      await repository.deleteOne(member.id);
      expect(repository.get(member.id)).rejects.toBeInstanceOf(MemberNotFound);
    });
    it('silent error if member does not exist', async () => {
      await repository.deleteOne(v4());
    });
  });

  describe('get', () => {
    it('get member', async () => {
      const member = await rawRepository.save(MemberFactory());

      const m = await repository.get(member.id);
      expectMember(m, member);
    });

    it('throw for undefined id', async () => {
      expect(repository.get(undefined!)).rejects.toBeInstanceOf(MemberNotFound);
    });

    it('throw for member does not exist', async () => {
      expect(repository.get(v4())).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getMany', () => {
    it('get members', async () => {
      const members = [
        await rawRepository.save(MemberFactory()),
        await rawRepository.save(MemberFactory()),
      ];

      const ms = await repository.getMany(members.map((m) => m.id));
      expectMembersById(members, ms.data);
    });
    it('get members with errors', async () => {
      const members = [
        await rawRepository.save(MemberFactory()),
        await rawRepository.save(MemberFactory()),
      ];

      const errorMemberId = v4();
      const ids = [...members.map((m) => m.id), errorMemberId];
      const ms = await repository.getMany(ids);

      expectMembersById(members, ms.data);
      expect(ms.errors[0]).toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getByEmail', () => {
    it('get member by email', async () => {
      const member = await rawRepository.save(
        MemberFactory({ email: faker.internet.email().toLowerCase() }),
      );

      const m = await repository.getByEmail(member.email);
      expectMember(m, member);
    });

    it('throw for undefined email', async () => {
      expect(repository.getByEmail(undefined!)).rejects.toThrow();
    });

    it('return null for unexisting email', async () => {
      expect(await repository.getByEmail('email@email.com')).toBeNull();
    });

    it('throw for unexisting email and shouldExist=true', async () => {
      expect(
        repository.getByEmail('email@email.com', { shouldExist: true }),
      ).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('getManyByEmail', () => {
    it('get members by email', async () => {
      const members = [
        await rawRepository.save(MemberFactory()),
        await rawRepository.save(MemberFactory()),
      ];

      const ms = await repository.getManyByEmail(members.map((m) => m.email));

      for (const m of members) {
        const expectM = ms.data[m.email];
        if (!expectM) {
          throw new Error('expected member should be defined');
        }
        expectMember(expectM, m);
      }
    });

    it('return error for unexisting email', async () => {
      const members = [
        await rawRepository.save(MemberFactory()),
        await rawRepository.save(MemberFactory()),
      ];
      const errorMemberMail = 'email@email.com';

      const emails = [...members.map((m) => m.email), errorMemberMail];
      const ms = await repository.getManyByEmail(emails);

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
      const member = await rawRepository.save(MemberFactory());
      const newMember = { name: 'newname', email: faker.internet.email().toLowerCase() };
      const newM = await repository.patch(member.id, newMember);

      expectMember(newM, { ...member, ...newMember });
    });

    it('patch extra', async () => {
      const member = await rawRepository.save(
        MemberFactory({ extra: { hasAvatar: true, lang: 'en' } }),
      );
      const extra = { lang: 'fr', emailFreq: EmailFrequency.Never };
      const newM = await repository.patch(member.id, { extra });

      // keep previous extra
      expect(newM.extra.hasAvatar).toBe(true);
      // update previous extra
      expect(newM.extra.lang).toEqual('fr');
      // add new extra
      expect(newM.extra.emailFreq).toEqual(EmailFrequency.Never);
    });

    it('patch enableSaveActions', async () => {
      const member = await rawRepository.save(MemberFactory());
      const newMember = { enableSaveActions: false };
      const newM = await repository.patch(member.id, newMember);

      expect(newM.enableSaveActions).toBe(false);
    });

    it('does not update for empty new data', async () => {
      const member = await rawRepository.save(MemberFactory());
      const newM = await repository.patch(member.id, {});

      expectMember(newM, member);
    });

    it('update unexisting member', async () => {
      const newMember = { enableSaveActions: false };

      expect(repository.patch(v4(), newMember)).rejects.toBeInstanceOf(MemberNotFound);
    });
  });

  describe('post', () => {
    it('post member', async () => {
      const newMember = { name: 'newname', email: faker.internet.email().toLowerCase() };
      const newM = await repository.post(newMember);

      expect(newM.name).toEqual(newMember.name);
      expect(newM.email).toEqual(newMember.email);
      expect(newM.userAgreementsDate.getDate()).toEqual(new Date().getDate());
    });

    it('throw if email already exists', async () => {
      const member = await rawRepository.save(MemberFactory());
      expect(repository.post(member)).rejects.toMatchObject({ code: '23505' });
    });
  });
});
