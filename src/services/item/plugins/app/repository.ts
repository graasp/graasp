import { ArrayContains } from 'typeorm';

import { AuthTokenSubject } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { App } from './entities/app';
import { InvalidApplicationOrigin } from './errors';

export const AppRepository = AppDataSource.getRepository(App).extend({
  async getAll(publisherId?: string) {
    // TODO: undefined should get all
    return this.findBy({ publisher: { id: publisherId } });
  },

  async getMostUsedApps(memberId: string) {
    return this.createQueryBuilder('app')
      .leftJoin('item', "item.extra::json->>'app'->>'url' = app.url")
      .select('item.creator_id', memberId)
      .addselect('app.url', 'url')
      .addSelect('app.name', 'name')
      .addSelect('COUNT(item.id)', 'nbr')
      .groupBy('app.url')
      .addGroupBy('app.name')
      .orderBy('nbr', 'DESC');
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
    memberId: string | undefined,
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
