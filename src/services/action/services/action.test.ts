import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ActionFactory, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { BaseLogger } from '../../../logger';
import { AppDataSource } from '../../../plugins/datasource';
import { MailerService } from '../../../plugins/mailer/service';
import { buildRepositories } from '../../../utils/repositories';
import { MeiliSearchWrapper } from '../../item/plugins/publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../../item/plugins/thumbnail/service';
import { ItemService } from '../../item/service';
import { MemberService } from '../../member/service';
import { saveMember } from '../../member/test/fixtures/members';
import { ThumbnailService } from '../../thumbnail/service';
import { Action } from '../entities/action';
import { ActionService } from './action';

const service = new ActionService(
  new ItemService(
    {} as ThumbnailService,
    {} as ItemThumbnailService,
    {} as MeiliSearchWrapper,
    {} as BaseLogger,
  ),
  new MemberService({} as MailerService, {} as BaseLogger),
  {} as BaseLogger,
);
const rawRepository = AppDataSource.getRepository(Action);

export const MOCK_REQUEST = {
  headers: { origin: 'https://origin.com' },
  raw: { headers: { 'x-forwarded-for': '' }, socket: { remoteAddress: 'address' } },
} as unknown as FastifyRequest;

describe('ActionService', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
    actor = null;
  });

  describe('postMany', () => {
    it('post many actions', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
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
      actor = await saveMember(MemberFactory({ enableSaveActions: false }));
      mockAuthenticate(actor);
      const actions = [ActionFactory(), ActionFactory(), ActionFactory()] as unknown as Action[];
      const request = MOCK_REQUEST;
      await service.postMany(actor, buildRepositories(), request, actions);

      expect(await rawRepository.count()).toEqual(0);
    });
  });
});
