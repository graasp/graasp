import { In } from 'typeorm';

import { FileItemType } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberNotFound } from '../../util/graasp-error';
import { Item } from '../item/entities/Item';
import { mapById } from '../utils';
import { Member } from './entities/member';

export const MemberRepository = AppDataSource.getRepository(Member).extend({
  async deleteOne(id: string) {
    // TODO:
    // check member exists
    return this.delete(id);
  },

  async get(id: string) {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    // TODO: improve
    if (!id) {
      throw new Error('id should not be falsy');
    }
    const m = await this.findOneBy({ id });
    if (!m) {
      throw new MemberNotFound(id);
    }
    return m;
  },

  async getMany(ids: string[]) {
    const members = await this.find({ where: { id: In(ids) } });
    return mapById({
      keys: ids,
      findElement: (id) => members.find(({ id: thisId }) => thisId === id),
      buildError: (id) => new MemberNotFound(id),
    });
  },

  async getByEmail(emailString: string, args: { shouldExist?: boolean } = {}) {
    const email = emailString.toLowerCase();
    const member = await this.findOneBy({ email });

    if (args.shouldExist) {
      if (!member) {
        throw new MemberNotFound({ email });
      }
    }
    return member;
  },

  async getManyByEmail(emails: string[]) {
    const members = await this.find({ where: { email: In(emails) } });
    return mapById({
      keys: emails,
      findElement: (email) => members.find(({ email: thisEmail }) => thisEmail === email),
      buildError: (email) => new MemberNotFound(email),
    });
  },

  async getMemberStorage(memberId: string, itemType: FileItemType) {
    const fileItems = await this.createQueryBuilder()
      .select('item')
      .from(Item, 'item')
      .leftJoinAndSelect('item.creator', 'member')
      .where('member.id = :memberId', { memberId })
      .andWhere('item.type = :type', { type: itemType })
      // .addSelect(`SUM(item.extra->'${itemType}'->'size')`, 'total')
      .getMany();
    return fileItems.reduce((sum, item) => {
      return sum + Math.max(0, item.extra[itemType].size);
    }, 0);
  },

  async patch(id, body) {
    const extra = Object.assign({}, body?.extra, body.extra);

    // TODO: check member exists
    await this.update(id, { name: body.name, email: body.email, extra });

    // todo: optimize?
    return this.get(id);
  },

  async post(data: Partial<Member> & Pick<Member, 'email'>) {
    const email = data.email.toLowerCase();
    const createdMember = await this.insert({ ...data, email });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(createdMember.identifiers[0].id);
  },
});
export default MemberRepository;
