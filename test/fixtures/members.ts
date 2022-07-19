import { v4 as uuidv4 } from 'uuid';

import { Member, MemberType, UnknownExtra } from '@graasp/sdk';

export const buildMember = (options: {
  id?: string;
  name?: string;
  email?: string;
  extra?: UnknownExtra;
  password?: string;
}): Member => {
  const id = uuidv4();
  return {
    id: options.id ?? id,
    name: options.name ?? id,
    email: options.email ?? `${options.name}@email.com`,
    createdAt: '2021-03-29T08:46:52.939Z',
    updatedAt: '2021-03-29T08:46:52.939Z',
    extra: options.extra ?? {},
    type: MemberType.Individual,
    password: options.password,
  };
};

export const ACTOR = buildMember({
  name: 'actor',
});

export const ANNA = buildMember({ name: 'anna' });

export const BOB = buildMember({ name: 'bob', extra: { lang: 'fr' } });

export const LOUISA = buildMember({
  name: 'louisa',
  extra: { lang: 'fr' },
  password: '$2b$10$WFVpHW6qSpZrMnk06Qxmtuzu1OU2C3LqQby5szT0BboirsNx4cdD.',
});
