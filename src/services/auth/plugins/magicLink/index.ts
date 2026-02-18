import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PassportUser } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { AUTH_CLIENT_HOST } from '../../../../utils/config';
import { MemberAlreadySignedUp } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { InvitationService } from '../../../item/plugins/invitation/service';
import { isMember } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { getRedirectionUrl } from '../../utils';
import captchaPreHandler from '../captcha';
import { PassportStrategy } from '../passport/strategies';
import { PassportInfo } from '../passport/types';
import { auth, login, register } from './schemas';
import { MagicLinkService } from './service';

const ERROR_SEARCH_PARAM = 'error';
const ERROR_SEARCH_PARAM_HAS_ERROR = 'true';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const memberService = resolveDependency(MemberService);
  const magicLinkService = resolveDependency(MagicLinkService);
  const invitationService = resolveDependency(InvitationService);

  // register
  fastify.post(
    '/register',
    { schema: register, preHandler: captchaPreHandler(RecaptchaAction.SignUp) },
    async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG },
      } = request;
      const { url } = body;
      return db.transaction(async (manager) => {
        try {
          const repositories = buildRepositories(manager);
          // we use member service to allow post hook for invitation
          const member = await memberService.post(undefined, repositories, body, lang);
          await magicLinkService.sendRegisterMail(undefined, repositories, member, url);
          // transform memberships from existing invitations
          await invitationService.createToMemberships(repositories, member);

          reply.status(StatusCodes.NO_CONTENT);
        } catch (e) {
          if (!(e instanceof MemberAlreadySignedUp)) {
            throw e;
          }
          // send login email
          await magicLinkService.login(undefined, buildRepositories(manager), body, lang);
          reply.status(StatusCodes.NO_CONTENT);
        }
      });
    },
  );

  // login
  fastify.post(
    '/login',
    {
      schema: login,
      preHandler: captchaPreHandler(RecaptchaAction.SignIn),
    },
    async (request, reply) => {
      const { body } = request;
      const { url } = body;

      await magicLinkService.login(undefined, buildRepositories(), body, url);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // authenticate
  fastify.get(
    '/auth',
    {
      schema: auth,
      preHandler: fastifyPassport.authenticate(
        PassportStrategy.WebMagicLink,
        async (request, reply, err, user?: PassportUser, info?: PassportInfo) => {
          // This function is called after the strategy has been executed.
          // It is necessary, so we match the behavior of the original implementation.
          if (!user || err) {
            // Authentication failed
            const target = new URL('/', AUTH_CLIENT_HOST);
            target.searchParams.set(ERROR_SEARCH_PARAM, ERROR_SEARCH_PARAM_HAS_ERROR);
            reply.redirect(StatusCodes.SEE_OTHER, target.toString());
          } else {
            request.logIn(user, { session: true });
            request.authInfo = info;
          }
        },
      ),
    },
    async (request, reply) => {
      const {
        user,
        authInfo,
        query: { url },
        log,
      } = request;
      const member = asDefined(user?.account);
      const redirectionUrl = getRedirectionUrl(log, url ? decodeURIComponent(url) : undefined);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await memberService.refreshLastAuthenticatedAt(member.id, repositories);
        // on auth, if the user used the email sign in, its account gets validated
        if (authInfo?.emailValidation && isMember(member) && !member.isValidated) {
          await memberService.validate(member.id, repositories);
        }
      });
      reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
    },
  );

  // logout
  fastify.get('/logout', async (request, reply) => {
    // logout user, so subsequent calls can not make use of the current user.
    request.logout();
    // remove session so the cookie is removed by the browser
    request.session.delete();
    reply.status(StatusCodes.NO_CONTENT);
  });
};

export default plugin;
