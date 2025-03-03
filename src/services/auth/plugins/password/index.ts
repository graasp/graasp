import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers, Context, RecaptchaAction } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { ActionInsertDTO } from '../../../../drizzle/types';
import { asDefined } from '../../../../utils/assertions';
import {
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PUBLIC_URL,
} from '../../../../utils/config';
import { ActionService } from '../../../action/action.service';
import { matchOne } from '../../../authorization';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { getRedirectionLink } from '../../utils';
import captchaPreHandler from '../captcha';
import {
  SHORT_TOKEN_PARAM,
  authenticatePassword,
  authenticatePasswordReset,
  isAuthenticated,
} from '../passport';
import {
  getMembersCurrentPasswordStatus,
  passwordLogin,
  patchResetPasswordRequest,
  postResetPasswordRequest,
  setPassword,
  updatePassword,
} from './schemas';
import { MemberPasswordService } from './service';

const REDIRECTION_URL_PARAM = 'url';
const AUTHENTICATION_FALLBACK_ROUTE = '/auth';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const actionService = resolveDependency(ActionService);
  const memberPasswordService = resolveDependency(MemberPasswordService);

  // login with password
  fastify.post(
    '/login-password',
    {
      schema: passwordLogin,
      preHandler: [
        captchaPreHandler(RecaptchaAction.SignInWithPassword, {
          shouldFail: false,
        }),
        authenticatePassword,
      ],
    },
    async (request, reply) => {
      const { body, log, user } = request;
      const { url } = body;
      const member = asDefined(user?.account);

      const token = await memberPasswordService.generateToken(
        { sub: member.id },
        `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      );
      const redirectionUrl = getRedirectionLink(log, url);

      const target = new URL(AUTHENTICATION_FALLBACK_ROUTE, PUBLIC_URL);
      target.searchParams.set(SHORT_TOKEN_PARAM, token);
      target.searchParams.set(REDIRECTION_URL_PARAM, redirectionUrl);
      const resource = target.toString();

      reply.status(StatusCodes.SEE_OTHER);
      return { resource };
    },
  );

  /**
   * Set a password for the authenticated member.
   * If a password alread exists it will return a 409 (Conflict) error.
   * @param password - The new password.
   * @returns 204 No Content if the request was successful.
   */
  fastify.post(
    '/password',
    {
      schema: setPassword,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body: { password } }, reply) => {
      const member = asDefined(user?.account);
      return db.transaction(async (tx) => {
        await memberPasswordService.post(tx, member, password);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );

  /**
   * Update the password of the authenticated member.
   * If the currentPassword does not match what is stored an error will be returned.
   * @param currentPassword - The current password of the user.
   * @param password - The new password.
   * @returns 204 No Content if the request was successful.
   */
  fastify.patch(
    '/password',
    {
      schema: updatePassword,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body: { currentPassword, password } }, reply) => {
      const member = asDefined(user?.account);
      return db.transaction(async (tx) => {
        await memberPasswordService.patch(
          tx,
          member,
          password,
          currentPassword,
        );
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );

  /**
   * Create a reset password request.
   * This will send an email to the member in his langage with a link to reset the password.
   * The link targets a frontend route endpoint.
   * The link will be valid for 24h.
   * If the member does not exist, or does not have a password, the request will return success, to avoid leaking information.
   * If the captcha is invalid the request will fail.
   * @param email - Email of the member requesting the password reset link.
   * @param captcha - Recaptcha response token.
   * @returns 204 No Content if the request was successful.
   */
  fastify.post(
    '/password/reset',
    {
      schema: postResetPasswordRequest,
      preHandler: captchaPreHandler(RecaptchaAction.ResetPassword),
    },
    async (request, reply) => {
      const { email } = request.body;

      // We can already return to avoid leaking timing information.
      reply.status(StatusCodes.NO_CONTENT);
      // need to await this
      await reply.send();

      const resetPasswordRequest =
        await memberPasswordService.createResetPasswordRequest(db, email);
      if (resetPasswordRequest) {
        const { token, member: memberInfo } = resetPasswordRequest;
        memberPasswordService.mailResetPasswordRequest(
          email,
          token,
          memberInfo.lang,
        );
        const action = {
          member: memberInfo,
          type: ActionTriggers.AskResetPassword,
          view: Context.Auth,
          extra: JSON.stringify('{}'),
        };
        // Do not await the action to be saved. It is not critical.
        actionService.postMany(db, memberInfo, request, [action]);
      }
    },
  );

  /**
   * Solve the reset password request.
   * This will force the password to be updated.
   * A special token is required to perform this action. This token is sent by email to the member after creating a reset password request.
   * If the password is not strong enough, the request will fail with an error 400 Bad Request.
   * @param password - New password.
   * @returns 204 No Content if the request was successful.
   */
  fastify.patch(
    '/password/reset',
    {
      schema: patchResetPasswordRequest,
      preHandler: authenticatePasswordReset,
    },
    async (request, reply) => {
      const {
        user,
        body: { password },
      } = request;
      const uuid = asDefined(user?.passwordResetRedisKey);
      await memberPasswordService.applyReset(db, password, uuid);
      try {
        const member = await memberPasswordService.getMemberByPasswordResetUuid(
          db,
          uuid,
        );
        reply.status(StatusCodes.NO_CONTENT);

        // Log the action
        const action = {
          accountId: member.id,
          type: ActionTriggers.ResetPassword,
          view: Context.Auth,
          extra: JSON.stringify('{}'),
        } satisfies ActionInsertDTO;
        // Do not await the action to be saved. It is not critical.
        actionService.postMany(db, member.toMaybeUser(), request, [action]);
      } catch {
        // do nothing
      }
    },
  );

  /**
   * Get a boolean indicating if the authenticated member has a password.
   */
  fastify.get(
    '/members/current/password/status',
    {
      schema: getMembersCurrentPasswordStatus,
      preHandler: [isAuthenticated],
    },
    async ({ user }) => {
      const account = asDefined(user?.account);
      const hasPassword = await memberPasswordService.hasPassword(
        db,
        account.id,
      );
      return { hasPassword };
    },
  );
};

export default plugin;
