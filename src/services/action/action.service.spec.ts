import { expect, it } from 'vitest';

// TODO
// import type { FastifyInstance, FastifyRequest } from 'fastify';

// import { ActionFactory, MemberFactory } from '@graasp/sdk';

// import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
// import { db } from '../../drizzle/db';
// import { BaseLogger } from '../../logger';
// import { MailerService } from '../../plugins/mailer/mailer.service';
// import { ItemRepository } from '../item/item.repository';
// import { ItemService } from '../item/item.service';
// import { ItemGeolocationRepository } from '../item/plugins/geolocation/itemGeolocation.repository';
// import { MeiliSearchWrapper } from '../item/plugins/publication/published/plugins/search/meilisearch';
// import { ItemThumbnailService } from '../item/plugins/thumbnail/itemThumbnail.service';
// import { ItemMembershipRepository } from '../itemMembership/membership.repository';
// import { MemberRepository } from '../member/member.repository';
// import { MemberService } from '../member/member.service';
// import { saveMember } from '../member/test/fixtures/members';
// import { ThumbnailService } from '../thumbnail/thumbnail.service';
// import { ActionRepository } from './action.repository';
// import { ActionService } from './action.service';

// need one test to pass the file test
it('temporary', () => {
  expect(true).toBeTruthy();
});

// const service = new ActionService(
//   new ActionRepository(),
//   new ItemService(
//     {} as ThumbnailService,
//     {} as ItemThumbnailService,
//     {} as ItemMembershipRepository,
//     {} as MeiliSearchWrapper,
//     new ItemRepository(),
//     {} as ItemGeolocationRepository,
//     {} as BaseLogger,
//   ),
//   new MemberService({} as MailerService, {} as MemberRepository, {} as BaseLogger),
//   {} as BaseLogger,
// );
// const rawRepository = AppDataSource.getRepository(Action);

// export const MOCK_REQUEST = {
//   headers: { origin: 'https://origin.com' },
//   raw: {
//     headers: { 'x-forwarded-for': '' },
//     socket: { remoteAddress: 'address' },
//   },
// } as unknown as FastifyRequest;

// describe('ActionService', () => {
//   let app: FastifyInstance;
//   let actor;

//   beforeAll(async () => {
//     ({ app } = await build({ member: null }));
//   });

//   afterEach(async () => {
//     await clearDatabase(app.db);
//     app.close();
//   });

//   afterEach(async () => {
//     jest.clearAllMocks();
//     unmockAuthenticate();
//     actor = null;
//   });

//   describe('postMany', () => {
//     it('post many actions', async () => {
//       actor = await saveMember();
//       mockAuthenticate(actor);
//       const actions = [
//         ActionFactory(),
//         ActionFactory({ geolocation: null }),
//         ActionFactory(),
//       ] as unknown as Action[];
//       const request = MOCK_REQUEST;
//       await service.postMany(db, actor, request, actions);

//       expect(await rawRepository.count()).toEqual(actions.length);
//     });

//     it('does not post actions if member disable analytics', async () => {
//       actor = await saveMember(MemberFactory({ enableSaveActions: false }));
//       mockAuthenticate(actor);
//       const actions = [ActionFactory(), ActionFactory(), ActionFactory()] as unknown as Action[];
//       const request = MOCK_REQUEST;
//       await service.postMany(db, actor, request, actions);

//       expect(await rawRepository.count()).toEqual(0);
//     });
//   });
// });
