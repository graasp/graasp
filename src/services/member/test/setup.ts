import { faker } from '@faker-js/faker';
import assert from 'assert';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemLoginSchemaType } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { Guest } from '../../itemLogin/entities/guest';
import { ItemLoginSchema } from '../../itemLogin/entities/itemLoginSchema';

const testUtils = new ItemTestUtils();

const rawItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchema);
const rawGuestRepository = AppDataSource.getRepository(Guest);

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
  const currentGuest = await rawGuestRepository.findOneBy({ id: loginResponse.json().id });
  assert(currentGuest);

  return { guest: currentGuest };
};
