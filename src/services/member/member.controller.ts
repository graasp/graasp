import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { AccountType } from '../../types';
import { asDefined, assertIsDefined } from '../../utils/assertions';
import { AccountRepository } from '../account/account.repository';
import { ActionService } from '../action/action.service';
import {
  authenticateEmailChange,
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../auth/plugins/passport';
import { assertIsMember } from '../authentication';
import {
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
  FILE_METADATA_MIN_PAGE_SIZE,
} from './constants';
import { EmailAlreadyTaken } from './error';
import {
  deleteCurrent,
  emailSubscribe,
  emailUnsubscribe,
  getCurrent,
  getMemberSettings,
  getOne,
  getStorage,
  getStorageFiles,
  patchChangeEmail,
  postChangeEmail,
  updateCurrent,
} from './member.schemas';
import { MemberService } from './member.service';
import { StorageService } from './plugins/storage/memberStorage.service';
import { memberAccountRole } from './strategies/memberAccountRole';

const controller: FastifyPluginAsyncTypebox = async (fastify) => {
  const memberService = resolveDependency(MemberService);
  const accountRepository = resolveDependency(AccountRepository);
  const storageService = resolveDependency(StorageService);
  const actionService = resolveDependency(ActionService);

  // get current
  fastify.get(
    '/current',
    {
      schema: getCurrent,
      preHandler: isAuthenticated,
    },
    async (request) => {
      const { user } = request;
      if (user?.account) {
        const account = await accountRepository.get(db, user?.account?.id);
        const currentAccount = account.toCurrent();
        if (currentAccount && currentAccount.type === AccountType.Guest) {
          const itemLoginSchema = await accountRepository.getItemLoginSchemaForGuest(
            db,
            currentAccount.itemLoginSchemaId,
          );
          if (!itemLoginSchema) {
            // logout user, so subsequent calls can not make use of the current user.
            request.logout();
            // remove session so the cookie is removed by the browser
            request.session.delete();
            return null;
          }
          const value = {
            ...currentAccount,
            lang: itemLoginSchema.item.lang,
            itemLoginSchema: {
              item: {
                id: itemLoginSchema.item.id,
                name: itemLoginSchema.item.name,
                path: itemLoginSchema.item.path,
              },
            },
          };

          return value;
        }
        return currentAccount;
      }
      return null;
    },
  );
  // get current member storage and its limits
  fastify.get(
    '/current/storage',
    {
      schema: getStorage,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return storageService.getStorageLimits(db, member);
    },
  );
  // get current member storage files metadata
  fastify.get(
    '/current/storage/files',
    {
      schema: getStorageFiles,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, query: { page, pageSize } }, reply) => {
      if (
        page < FILE_METADATA_MIN_PAGE ||
        pageSize < FILE_METADATA_MIN_PAGE_SIZE ||
        pageSize > FILE_METADATA_MAX_PAGE_SIZE
      ) {
        return reply.status(StatusCodes.BAD_REQUEST).send();
      }
      const member = asDefined(user?.account);
      assertIsMember(member);
      const storageFilesMetadata = await storageService.getStorageFilesMetadata(db, member, {
        page,
        pageSize,
      });
      return {
        data: storageFilesMetadata,
        pagination: { page, pageSize },
      };
    },
  );
  // get member
  // PUBLIC ENDPOINT
  fastify.get(
    '/:id',
    { schema: getOne, preHandler: optionalIsAuthenticated },
    async ({ params: { id } }) => {
      const member = await memberService.get(db, id);
      // explicitly map the return object to not leak information
      return member.toPublicMember();
    },
  );
  // update current member
  fastify.patch(
    '/current',
    { schema: updateCurrent, preHandler: isAuthenticated },
    async ({ user, body }) => {
      const member = asDefined(user?.account);
      return db.transaction(async (tx) => {
        const patchedMember = await memberService.patch(tx, member.id, body);
        return patchedMember.toCurrent();
      });
    },
  );
  // delete current member
  fastify.delete(
    '/current',
    { schema: deleteCurrent, preHandler: isAuthenticated },
    async (request, reply) => {
      const { user } = request;
      const member = asDefined(user?.account);
      return db.transaction(async (tx) => {
        await memberService.deleteCurrent(member.id, tx);
        // logout member
        request.logOut();
        // remove session from browser
        request.session.delete();
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );
  fastify.post(
    '/current/email/change',
    {
      schema: postChangeEmail,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, body: { email } }, reply) => {
      const newEmail = email.toLowerCase();
      const account = asDefined(user?.account);
      assertIsMember(account);

      // check if there is a member that already has the new email
      if (await memberService.getByEmail(db, newEmail)) {
        // Email adress is already taken, throw an error
        throw new EmailAlreadyTaken();
      }

      // HACK: re-fetch the member from the repo to have it in full (so the types match)
      const member = await memberService.get(db, account.id);
      assertIsDefined(member);
      const memberInfo = member.toMemberInfo();
      const token = memberService.createEmailChangeRequest(memberInfo, newEmail);
      memberService.sendEmailChangeRequest(newEmail, token, memberInfo.lang);

      reply.status(StatusCodes.NO_CONTENT);
    },
  );
  fastify.patch(
    '/current/email/change',
    {
      schema: patchChangeEmail,
      preHandler: [authenticateEmailChange, matchOne(memberAccountRole)],
    },
    async ({ user }, reply) => {
      const emailModification = asDefined(user?.emailChange);
      const account = asDefined(user?.account);
      assertIsMember(account);
      await db.transaction(async (tx) => {
        if (await memberService.getByEmail(tx, emailModification.newEmail)) {
          // Email adress is already taken, throw an error
          throw new EmailAlreadyTaken();
        }
        // get old info for member
        const memberInfo = (await memberService.get(db, account.id)).toCurrent();

        await memberService.patch(tx, account.id, {
          email: emailModification.newEmail,
        });

        // send confirmation email to old email
        // we send the email asynchronously without awaiting
        memberService.mailConfirmEmailChangeRequest(
          memberInfo.email,
          emailModification.newEmail,
          memberInfo.lang,
        );
      });
      // this needs to be outside the transaction
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.post(
    '/current/emails/subscribe',
    {
      schema: emailSubscribe,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async (req, reply) => {
      const { user } = req;
      const account = asDefined(user?.account);
      assertIsMember(account);

      await db.transaction(async (tx) => {
        memberService.emailSubscribe(tx, account.id, true);
      });

      reply.status(StatusCodes.NO_CONTENT);

      // save action
      await actionService.postMany(db, account, req, [
        { type: 'email-subscribe', extra: { memberId: account.id } },
      ]);
    },
  );

  fastify.post(
    '/current/emails/unsubscribe',
    {
      schema: emailUnsubscribe,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async (req, reply) => {
      const { user } = req;
      const account = asDefined(user?.account);
      assertIsMember(account);

      await db.transaction(async (tx) => {
        memberService.emailSubscribe(tx, account.id, false);
      });

      reply.status(StatusCodes.NO_CONTENT);

      // save action
      await actionService.postMany(db, account, req, [
        { type: 'email-unsubscribe', extra: { memberId: account.id } },
      ]);
    },
  );

  fastify.get(
    '/current/settings',
    {
      schema: getMemberSettings,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async (req) => {
      const { user } = req;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const settings = await memberService.getSettings(db, member.id);

      return settings;
    },
  );
};

export default controller;
