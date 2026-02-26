import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { PassportUser } from 'fastify';

import { ClientManager, Context, DEFAULT_LANG, RecaptchaAction } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { MemberAlreadySignedUp } from '../../../../utils/errors';
import { isMember } from '../../../authentication';
import { InvitationService } from '../../../item/plugins/invitation/invitation.service';
import { MemberService } from '../../../member/member.service';
import { getRedirectionLink } from '../../utils';
import captchaPreHandler from '../captcha/captcha';
import { PassportStrategy } from '../passport/strategies';
import type { PassportInfo } from '../passport/types';
import { auth, login, register, signOut } from './magicLink.schemas';
import { MagicLinkService } from './magicLink.service';

const ERROR_SEARCH_PARAM = 'error';
const ERROR_SEARCH_PARAM_HAS_ERROR = 'true';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const memberService = resolveDependency(MemberService);
  const magicLinkService = resolveDependency(MagicLinkService);
  const invitationService = resolveDependency(InvitationService);

  fastify.post(
    '/register',
    { schema: register, preHandler: captchaPreHandler(RecaptchaAction.SignUp) },
    async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG },
      } = request;
      const { url } = body;
      return db.transaction(async (tx) => {
        try {
          // we use member service to allow post hook for invitation
          const member = await memberService.post(tx, body, lang);
          await magicLinkService.sendRegisterMail(member.toMemberInfo(), url);

          // transform memberships from existing invitations
          await invitationService.createToMemberships(tx, member);

          reply.status(StatusCodes.NO_CONTENT);
        } catch (e) {
          if (!(e instanceof MemberAlreadySignedUp)) {
            throw e;
          }
          // send login email
          await magicLinkService.login(tx, body, lang);
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

      await magicLinkService.login(db, body, url);
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        async (request, reply, err, user?: PassportUser, info?: PassportInfo) => {
          // This function is called after the strategy has been executed.
          // It is necessary, so we match the behavior of the original implementation.
          if (!user || err) {
            // Authentication failed
            const target = ClientManager.getInstance().getURLByContext(Context.Auth);
            target.searchParams.set(ERROR_SEARCH_PARAM, ERROR_SEARCH_PARAM_HAS_ERROR);
            reply.redirect(target.toString(), StatusCodes.SEE_OTHER);
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
      const redirectionLink = getRedirectionLink(log, url ? decodeURIComponent(url) : undefined);
      await db.transaction(async (tx) => {
        await memberService.refreshLastAuthenticatedAt(tx, member.id);
        // on auth, if the user used the email sign in, its account gets validated
        if (authInfo?.emailValidation && isMember(member) && !member.isValidated) {
          await memberService.validate(tx, member.id);
        }
      });
      reply.redirect(redirectionLink, StatusCodes.SEE_OTHER);
    },
  );

  // logout
  fastify.post('/logout', { schema: signOut }, async (request, reply) => {
    // logout user, so subsequent calls can not make use of the current user.
    request.logout();
    // remove session so the cookie is removed by the browser
    request.session.delete();
    reply.status(StatusCodes.NO_CONTENT);
  });
};

export default plugin;
