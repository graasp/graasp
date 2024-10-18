import { faker } from '@faker-js/faker';
import assert from 'assert';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemLoginSchemaType } from '@graasp/sdk';

import { AppDataSource } from '../src/plugins/datasource';
import { Account } from '../src/services/account/entities/account';
import { ItemTestUtils } from '../src/services/item/test/fixtures/items';
import { ItemLoginSchema as ItemLoginSchemaEntity } from '../src/services/itemLogin/entities/itemLoginSchema';
import { ITEMS_ROUTE_PREFIX } from '../src/utils/config';

const testUtils = new ItemTestUtils();

const rawItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchemaEntity);
const rawAccountRepository = AppDataSource.getRepository(Account);

/**
 * Setup environment for a guest logging in
 * @param app running application
 * @returns current guest information
 */
export const setupGuest = async (app: FastifyInstance) => {
  const item = await testUtils.saveItem({});
  await rawItemLoginSchemaRepository.save({
    item,
    type: ItemLoginSchemaType.Username,
  });

  // inject login - necessary to fill lastAuthenticated correctly
  const loginResponse = await app.inject({
    method: HttpMethod.Post,
    url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
    payload: { username: faker.person.firstName() },
  });

  // necessary to fetch complete guest to return correct current account
  const currentGuest = await rawAccountRepository.findOneBy({ id: loginResponse.json().id });
  assert(currentGuest);

  return { guest: currentGuest };
};
