import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ActionFactory, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app.js';
import { db } from '../../drizzle/db.js';
import { BaseLogger } from '../../logger.js';
import { MailerService } from '../../plugins/mailer/mailer.service.js';
import { ItemGeolocationRepository } from '../item/plugins/geolocation/geolocation.repository.js';
import { MeiliSearchWrapper } from '../item/plugins/publication/published/plugins/search/meilisearch.js';
import { ItemThumbnailService } from '../item/plugins/thumbnail/service.js';
import { ItemRepository } from '../item/repository.js';
import { ItemService } from '../item/service.js';
import { ItemMembershipRepository } from '../itemMembership/repository.js';
import { MemberRepository } from '../member/member.repository.js';
import { MemberService } from '../member/member.service.js';
import { saveMember } from '../member/test/fixtures/members.js';
import { ThumbnailService } from '../thumbnail/service.js';
import { ActionRepository } from './action.repository.js';
import { ActionService } from './action.service.js';

const service = new ActionService(
  new ActionRepository(),
  new ItemService(
    {} as ThumbnailService,
    {} as ItemThumbnailService,
    {} as ItemMembershipRepository,
    {} as MeiliSearchWrapper,
    new ItemRepository(),
    {} as ItemGeolocationRepository,
    {} as BaseLogger,
  ),
  new MemberService({} as MailerService, {} as MemberRepository, {} as BaseLogger),
  {} as BaseLogger,
);
const rawRepository = AppDataSource.getRepository(Action);

export const MOCK_REQUEST = {
  headers: { origin: 'https://origin.com' },
  raw: {
    headers: { 'x-forwarded-for': '' },
    socket: { remoteAddress: 'address' },
  },
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
      await service.postMany(db, actor, request, actions);

      expect(await rawRepository.count()).toEqual(actions.length);
    });

    it('does not post actions if member disable analytics', async () => {
      actor = await saveMember(MemberFactory({ enableSaveActions: false }));
      mockAuthenticate(actor);
      const actions = [ActionFactory(), ActionFactory(), ActionFactory()] as unknown as Action[];
      const request = MOCK_REQUEST;
      await service.postMany(db, actor, request, actions);

      expect(await rawRepository.count()).toEqual(0);
    });
  });
});
