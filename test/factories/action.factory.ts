import { faker } from '@faker-js/faker';
import { subMinutes, subMonths } from 'date-fns';
import geoip from 'geoip-lite';

import { Context } from '@graasp/sdk';

import { ActionRaw } from '../../src/drizzle/types';

export const ActionFactory = (a: Partial<ActionRaw> = {}): ActionRaw => {
  const now = subMinutes(new Date(), 1); // Today's date
  const oneMonthAgo = subMonths(new Date(), 1); //  one month ago

  return {
    id: faker.string.uuid(),
    // member and item default to null
    accountId: null,
    itemId: null,
    view: faker.helpers.arrayElement(Object.values(Context)),
    type: faker.lorem.word(),
    extra: { value: faker.lorem.word() },
    createdAt: faker.date.between({ from: oneMonthAgo, to: now }).toISOString(),
    geolocation: faker.helpers.arrayElement([
      null,
      {
        range: [faker.number.int(), faker.number.int()],
        country: faker.location.country(),
        timezone: faker.location.timeZone(),
        city: faker.location.city(),
        ll: [faker.location.latitude(), faker.location.longitude()],
        region: 'region',
        eu: '1',
        metro: 1,
        area: 1,
      } as geoip.Lookup,
    ]),
    ...a,
  };
};
