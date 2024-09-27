import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ActionFactory, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { BaseLogger } from '../../../logger';
import { AppDataSource } from '../../../plugins/datasource';
import { MailerService } from '../../../plugins/mailer/service';
import { buildRepositories } from '../../../utils/repositories';
import { ItemThumbnailService } from '../../item/plugins/thumbnail/service';
import { ItemService } from '../../item/service';
import { MemberService } from '../../member/service';
import { ThumbnailService } from '../../thumbnail/service';
import { Action } from '../entities/action';
import { ActionService } from './action';

const service = new ActionService(
  new ItemService({} as ThumbnailService, {} as ItemThumbnailService, {} as BaseLogger),
  new MemberService({} as MailerService, {} as BaseLogger),
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
