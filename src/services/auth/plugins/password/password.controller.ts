import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers, Context, RecaptchaAction } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import type { ActionInsertDTO } from '../../../../drizzle/types';
import { asDefined } from '../../../../utils/assertions';
import { ActionService } from '../../../action/action.service';
import { View } from '../../../item/plugins/action/itemAction.schemas';
import { MemberService } from '../../../member/member.service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import captchaPreHandler from '../captcha/captcha';
import {
  authenticatePassword,
  authenticatePasswordReset,
  isAuthenticated,
  matchOne,
} from '../passport';
import {
  createPassword,
  getOwnPasswordStatus,
  requestPasswordResetLink,
  resetPassword,
  signInWithPassword,
  updatePassword,
} from './password.schemas';
import { MemberPasswordService } from './password.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const actionService = resolveDependency(ActionService);
  const memberService = resolveDependency(MemberService);
  const memberPasswordService = resolveDependency(MemberPasswordService);

  // login with password
  fastify.post(
    '/login-password',
    {
      schema: signInWithPassword,
      preHandler: [
        captchaPreHandler(RecaptchaAction.SignInWithPassword, {
          shouldFail: false,
        }),
        authenticatePassword,
      ],
    },
    async (request, reply) => {
      const { user } = request;
      request.logIn(user, { session: true });

      // update last authenticated date
      const member = asDefined(user?.account);
      await db.transaction(async (tx) => {
        await memberService.refreshLastAuthenticatedAt(tx, member.id);
      });

      reply.status(StatusCodes.NO_CONTENT);
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
      schema: createPassword,
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
        await memberPasswordService.patch(tx, member, password, currentPassword);
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
      schema: requestPasswordResetLink,
      preHandler: captchaPreHandler(RecaptchaAction.ResetPassword),
    },
    async (request, reply) => {
      const { email } = request.body;

      // We can already return to avoid leaking timing information.
      reply.status(StatusCodes.NO_CONTENT);
      // need to await this
      await reply.send();

      const resetPasswordRequest = await memberPasswordService.createResetPasswordRequest(
        db,
        email,
      );
      if (resetPasswordRequest) {
        const { token, member: memberInfo } = resetPasswordRequest;
        memberPasswordService.mailResetPasswordRequest(email, token, memberInfo.lang);
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
      schema: resetPassword,
      preHandler: authenticatePasswordReset,
    },
    async (request, reply) => {
      const {
        user,
        body: { password },
      } = request;
      const uuid = asDefined(user?.passwordResetRedisKey);
      const member = await memberPasswordService.getMemberByPasswordResetUuid(db, uuid);
      await memberPasswordService.applyReset(db, password, uuid);
      try {
        reply.status(StatusCodes.NO_CONTENT);

        // Log the action
        const action = {
          accountId: member.id,
          type: ActionTriggers.ResetPassword,
          view: View.Auth,
          extra: {},
        } satisfies ActionInsertDTO;
        // Do not await the action to be saved. It is not critical.
        actionService.postMany(db, member.toMaybeUser(), request, [action]);
      } catch (e) {
        // do nothing
        console.error(e);
      }
    },
  );

  /**
   * Get a boolean indicating if the authenticated member has a password.
   */
  fastify.get(
    '/members/current/password/status',
    {
      schema: getOwnPasswordStatus,
      preHandler: [isAuthenticated],
    },
    async ({ user }) => {
      const account = asDefined(user?.account);
      const hasPassword = await memberPasswordService.hasPassword(db, account.id);
      return { hasPassword };
    },
  );
};

export default plugin;
