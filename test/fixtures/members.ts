import { v4 as uuidv4 } from 'uuid';
import { Member, MemberType, UnknownExtra } from '../../src';

export const buildMember = (options: {
  name?: string;
  email?: string;
  extra?: UnknownExtra;
}): Member => ({
  id: uuidv4(),
  name: options.name,
  email: options.email ?? `${options.name}@email.com`,
  createdAt: '2021-03-29T08:46:52.939Z',
  updatedAt: '2021-03-29T08:46:52.939Z',
  extra: options.extra ?? {},
  type: MemberType.Individual,
});

export const ACTOR = buildMember({
  name: 'actor',
  extra: {
    recycleBin: 'b3894999-c958-49c0-b5f0-f82dfebd941e',
  },
});

export const ANNA = buildMember({ name: 'anna' });

export const BOB = buildMember({ name: 'bob' });
