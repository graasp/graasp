import { StatusCodes } from 'http-status-codes';
import { DataSource } from 'typeorm';

import { buildRepositories } from '../../utils/repositories';
import { ItemServiceManager } from './itemServiceManager';
import { AppService } from './plugins/app/service';
import { H5PService } from './plugins/html/h5p/service';

export class ItemController {
  // get from injection
  private db: DataSource;
  private h5pService: H5PService;
  private appService: AppService;

  async copy(request, reply) {
    const {
      member,
      query: { id: ids },
      body: { parentId },
    } = request;

    // todo: replace with authenticate
    if (!member) {
      throw 'not authenticated';
    }

    this.db.transaction(async (manager) => {
      const repositories = buildRepositories(manager);

      const results = await Promise.all(
        ids.map(async (id) => {
          const service = await ItemServiceManager.getServiceForTypeFromId(repositories, id);

          // TODO: check permission here

          return service.copy(member, repositories, id, { parentId });
        }),
      );
      return { items: results.map(({ item }) => item), copies: results.map(({ copy }) => copy) };
    });
    // TODO: set back websocket

    reply.status(StatusCodes.ACCEPTED);
    return ids;
  }
}
