import { EntityManager, In, Repository } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberNotFound } from '../../utils/errors';
import { mapById } from '../utils';
import { Member } from './entities/member';

export class MemberRepository {
  private repository: Repository<Member>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(Member);
    } else {
      this.repository = AppDataSource.getRepository(Member);
    }
  }

  async deleteOne(id: string) {
    // TODO:
    // check member exists
    return this.repository.delete(id);
  }

  async get(id: string): Promise<Member> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!id) {
      throw new MemberNotFound(id);
    }
    const m = await this.repository.findOneBy({ id });
    if (!m) {
      throw new MemberNotFound(id);
    }
    return m;
  }

  async getMany(ids: string[]) {
    const members = await this.repository.find({ where: { id: In(ids) } });
    return mapById({
      keys: ids,
      findElement: (id) => members.find(({ id: thisId }) => thisId === id),
      buildError: (id) => new MemberNotFound(id),
    });
  }

  async getByEmail(emailString: string, args: { shouldExist?: boolean } = {}) {
    const email = emailString.toLowerCase();
    const member = await this.repository.findOneBy({ email });

    if (args.shouldExist) {
      if (!member) {
        throw new MemberNotFound({ email });
      }
    }
    return member;
  }

  async getManyByEmail(emails: string[]) {
    const members = await this.repository.find({ where: { email: In(emails) } });
    console.log(members);
    return mapById({
      keys: emails,
      findElement: (email) => members.find(({ email: thisEmail }) => thisEmail === email),
      buildError: (email) => new MemberNotFound(email),
    });
  }

  async patch(
    id: UUID,
    body: Partial<Pick<Member, 'extra' | 'email' | 'name' | 'enableSaveActions'>>,
  ) {
    const newData: Partial<Member> = {};

    if (body.name) {
      newData.name = body.name;
    }

    if (body.email) {
      newData.email = body.email;
    }

    if (body.extra) {
      newData.extra = Object.assign({}, body?.extra, body.extra);
    }

    if (typeof body.enableSaveActions === 'boolean') {
      newData.enableSaveActions = body.enableSaveActions;
    }

    // TODO: throw if newData is empty

    // TODO: check member exists
    await this.repository.update(id, newData);

    // todo: optimize?
    return this.get(id);
  }

  async post(data: Partial<Member> & Pick<Member, 'email'>): Promise<Member> {
    const email = data.email.toLowerCase();

    // The backend assumes user agrees to terms by creating an account.
    // The auth frontend only blocks the user to create an account without checking the boxes.
    // The frontend avoids sending agreement data to prevent manipulation of the agreement date.
    // The agreements links are included in the registration email as a reminder.
    const userAgreementsDate = new Date();
    const createdMember = await this.repository.insert({
      ...data,
      email,
      userAgreementsDate,
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(createdMember.identifiers[0].id);
  }
}
