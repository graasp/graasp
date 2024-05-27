import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';

import { ActionFactory, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { buildRepositories } from '../../../utils/repositories';
import { ItemService } from '../../item/service';
import { MemberService } from '../../member/service';
import { ThumbnailService } from '../../thumbnail/service';
import { Action } from '../entities/action';
import { ActionService } from './action';

// mock datasource
jest.mock('../../../plugins/datasource');

const service = new ActionService(
  new ItemService({} as unknown as ThumbnailService, {} as unknown as FastifyBaseLogger),
  new MemberService(),
);
const rawRepository = AppDataSource.getRepository(Action);

export const MOCK_REQUEST = {
  headers: { origin: 'origin' },
  raw: { headers: { 'x-forwarded-for': '' }, socket: { remoteAddress: 'address' } },
} as unknown as FastifyRequest;

describe('ActionService', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('postMany', () => {
    it('post many actions', async () => {
      ({ app, actor } = await build());
      const actions = [
        ActionFactory(),
        ActionFactory({ geolocation: null }),
        ActionFactory(),
      ] as unknown as Action[];
      const request = MOCK_REQUEST;
      await service.postMany(actor, buildRepositories(), request, actions);

      expect(await rawRepository.count()).toEqual(actions.length);
    });

    it('does not post actions if member disable analytics', async () => {
      ({ app, actor } = await build({
        member: MemberFactory({ enableSaveActions: false }),
      }));
      const actions = [ActionFactory(), ActionFactory(), ActionFactory()] as unknown as Action[];
      const request = MOCK_REQUEST;
      await service.postMany(actor, buildRepositories(), request, actions);

      expect(await rawRepository.count()).toEqual(0);
    });
  });
});
