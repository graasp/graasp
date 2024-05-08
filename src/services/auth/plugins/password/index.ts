import { StatusCodes } from 'http-status-codes';
import { ExtractJwt, Strategy } from 'passport-jwt';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';

import { PASSWORD_RESET_JWT_SECRET, PUBLIC_URL } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import {
  passwordLogin,
  patchResetPasswordRequest,
  postResetPasswordRequest,
  updatePassword,
} from './schemas';
import { MemberPasswordService } from './service';

const PASSPORT_STATEGY_ID = 'jwt-reset-password';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { mailer, log, db } = fastify;

  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  fastifyPassport.use(
    PASSPORT_STATEGY_ID,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: PASSWORD_RESET_JWT_SECRET,
        passReqToCallback: true,
      },
      async (req, _payload, done) => {
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (token && (await memberPasswordService.validateResetPasswordToken(token))) {
          return done(null, {});
        } else {
          return done(null, false);
        }
      },
    ),
  );

  const memberPasswordService = new MemberPasswordService(mailer, log);

  // login with password
  fastify.post<{
    Body: { email: string; password: string; captcha: string; url?: string };
  }>('/login-password', { schema: passwordLogin }, async (request, reply) => {
    const { body, log } = request;
    const { url } = body;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignInWithPassword, {
      shouldFail: false,
    });

    const token = await memberPasswordService.login(undefined, buildRepositories(), body);
    const redirectionUrl = getRedirectionUrl(log, url);

    const target = new URL('/auth', PUBLIC_URL);
    target.searchParams.set('t', token);
    target.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const resource = target.toString();

    reply.status(StatusCodes.SEE_OTHER);
    return { resource };
  });

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
   * The link target a frontend route endpoint.
   * The link will be valid for 24h.
   * If the member does not exist, or does not have a password, the request will return success, to avoid leaking information.
   * If the captcha is invalid the request will fail.
   * @param email - Email of the member requesting the password reset link.
   * @param captcha - Recaptcha response token.
   * @returns 204 No Content if the request was successful.
   */
  fastify.post<{ Body: { email: string; captcha: string } }>(
    '/reset-password-request',
    { schema: postResetPasswordRequest },
    async (request, reply) => {
      const { email, captcha } = request.body;

      // TODO : Validate specific recaptcha action
      await fastify.validateCaptcha(request, captcha, RecaptchaAction.SignInWithPassword, {
        shouldFail: false,
      });

      const resetPasswordRequest = await memberPasswordService.createResetPasswordRequest(
        buildRepositories(),
        email,
      );
      if (resetPasswordRequest) {
        const { token, lang } = resetPasswordRequest;
        memberPasswordService.mailResetPasswordRequest(email, token, lang);
      }
      reply.status(StatusCodes.NO_CONTENT);
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
  fastify.patch<{ Body: { password: string } }>(
    '/reset-password-request',
    {
      schema: patchResetPasswordRequest,
      preValidation: fastifyPassport.authenticate(PASSPORT_STATEGY_ID, { session: false }), // Session is not required.
    },
    async (req, reply) => {
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      const { password } = req.body;
      await memberPasswordService.forcePatch(buildRepositories(), password, token!);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
