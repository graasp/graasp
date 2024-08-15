import { ArrayContains, EntityManager } from 'typeorm';

import { AuthTokenSubject } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { App } from './entities/app';
import { InvalidApplicationOrigin } from './errors';

export class AppRepository extends AbstractRepository<App> {
  constructor(manager?: EntityManager) {
    super(App, manager);
  }
  async getAll(publisherId?: string) {
    // undefined should get all
    return await this.repository.findBy({ publisher: { id: publisherId } });
  }

  async getMostUsedApps(memberId: string): Promise<{ url: string; name: string; count: number }[]> {
    const data = await this.repository
      .createQueryBuilder('app')
      .innerJoin(
        'item',
        'item',
        "item.extra::json->'app'->>'url' = app.url AND item.creator_id = :memberId",
        { memberId },
      )
      .select('app.url', 'url')
      .addSelect('app.name', 'name')
      .addSelect('COUNT(item.id)', 'count')
      .groupBy('app.id, app.url, app.name')
      .orderBy('count', 'DESC')
      .getRawMany();
    return data;
  }

  async isValidAppOrigin(appDetails: { key: string; origin: string }) {
    const valid = await this.repository.findOneBy({
      key: appDetails.key,
      publisher: { origins: ArrayContains([appDetails.origin]) },
    });
    if (!valid) {
      throw new InvalidApplicationOrigin();
    }
  }

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
  }
}
