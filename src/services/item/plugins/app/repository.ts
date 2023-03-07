import { ArrayContains } from 'typeorm';

import { AuthTokenSubject } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { App } from './entities/app';
import { InvalidApplicationOrigin } from './util/graasp-apps-error';

export const AppRepository = AppDataSource.getRepository(App).extend({
  async getAll(publisherId?: string) {
    // TODO: undefined should get all
    return this.findBy({ publisher: { id: publisherId } });
  },

  async isValidAppOrigin(appDetails: { key: string; origin: string }) {
    const valid = await this.findOneBy({
      key: appDetails.key,
      publisher: { origins: ArrayContains([appDetails.origin]) },
    });
    if (!valid) {
      throw new InvalidApplicationOrigin();
    }
  },

  generateApiAccessTokenSubject(
    memberId: string,
    itemId: string,
    appDetails: { key: string; origin: string },
  ): AuthTokenSubject {
    return {
      memberId,
      itemId,
      key: appDetails.key, // useful??
      origin: appDetails.origin,
    };
  },
});
