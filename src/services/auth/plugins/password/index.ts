import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsync, PassportUser } from 'fastify';

import { ActionTriggers, Context, RecaptchaAction } from '@graasp/sdk';

import { LOGIN_TOKEN_EXPIRATION_IN_MINUTES, PUBLIC_URL } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import captchaPreHandler from '../captcha';
import { PassportStrategy } from '../passport/strategies';
import {
  passwordLogin,
  patchResetPasswordRequest,
  postResetPasswordRequest,
  updatePassword,
} from './schemas';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    memberPassword: { service: memberPasswordService },
  } = fastify;
  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  // login with password
  fastify.post<{
    Body: { email: string; password: string; captcha: string; url?: string };
  }>(
    '/login-password',
    {
      schema: passwordLogin,
      preHandler: [
        captchaPreHandler(RecaptchaAction.SignInWithPassword, {
          shouldFail: false,
        }),
        fastifyPassport.authenticate(PassportStrategy.WEB_PASSWORD),
      ],
    },
    async (request, reply) => {
      const { body, log, user } = request;
      const { url } = body;
      const token = await memberPasswordService.generateToken(
        { sub: user!.uuid },
        `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      );

      // TODO : Cleanup all this mess
      const redirectionUrl = getRedirectionUrl(log, url);

      const target = new URL('/auth', PUBLIC_URL);
      target.searchParams.set('t', token);
      target.searchParams.set('url', encodeURIComponent(redirectionUrl));
      const resource = target.toString();

      reply.status(StatusCodes.SEE_OTHER);
      return { resource };
    },
  );

  // update member password
  fastify.patch<{ Body: { currentPassword: string; password: string } }>(
    '/members/update-password',
    { schema: updatePassword, preHandler: fastify.verifyAuthentication },
    async ({ member, body: { currentPassword, password } }) => {
      if (!member) {
        throw new UnauthorizedMember(member);
      }
      return db.transaction(async (manager) => {
        return memberPasswordService.patch(
          member,
          buildRepositories(manager),
          password,
          currentPassword,
        );
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
  fastify.post<{ Body: { email: string; captcha: string } }>(
    '/password/reset',
    {
      schema: postResetPasswordRequest,
      preHandler: captchaPreHandler(RecaptchaAction.ResetPassword),
    },
    async (request, reply) => {
      const { email } = request.body;

      // We can already return to avoid leaking timing information.
      reply.status(StatusCodes.NO_CONTENT);
      reply.send();

      const repositories = buildRepositories();

      const resetPasswordRequest = await memberPasswordService.createResetPasswordRequest(
        repositories,
        email,
      );
      if (resetPasswordRequest) {
        const { token, member } = resetPasswordRequest;
        memberPasswordService.mailResetPasswordRequest(email, token, member.lang);
        const action = {
          member,
          type: ActionTriggers.AskResetPassword,
          view: Context.Auth,
          extra: {},
        };
        // Do not await the action to be saved. It is not critical.
        fastify.actions.service.postMany(member, repositories, request, [action]);
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
  fastify.patch<{ Body: { password: string }; User: { uuid: string } }>(
    '/password/reset',
    {
      schema: patchResetPasswordRequest,
      preHandler: fastifyPassport.authenticate(PassportStrategy.PASSPORT_RESET, {
        session: false,
      }), // Session is not required.
    },
    async (request, reply) => {
      const user: PassportUser = request.user!;
      const { password } = request.body;
      const repositories = buildRepositories();
      await memberPasswordService.applyReset(repositories, password, user.uuid);
      const member = await memberPasswordService.getMemberByPasswordResetUuid(
        repositories,
        user.uuid,
      );
      reply.status(StatusCodes.NO_CONTENT);

      // Log the action
      const action = {
        member,
        type: ActionTriggers.ResetPassword,
        view: Context.Auth,
        extra: {},
      };
      // Do not await the action to be saved. It is not critical.
      fastify.actions.service.postMany(member, repositories, request, [action]);
    },
  );
};

export default plugin;
