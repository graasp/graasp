import fastifyPassport from '@fastify/passport';
import { fastifySecureSession } from '@fastify/secure-session';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import {
  AUTH_TOKEN_JWT_SECRET,
  COOKIE_DOMAIN,
  JWT_SECRET,
  MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS,
  PROD,
  REFRESH_TOKEN_JWT_SECRET,
  SECURE_SESSION_EXPIRATION_IN_SECONDS,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
} from '../../../../utils/config';
import { AccountRepository } from '../../../account/account.repository';
import { ItemRepository } from '../../../item/repository';
import { MemberRepository } from '../../../member/member.repository';
import { MemberPasswordService } from '../password/service';
import { SHORT_TOKEN_PARAM, TOKEN_PARAM } from './constants';
import { PassportStrategy } from './strategies';
import emailChangeStrategy from './strategies/emailChange';
import jwtStrategy from './strategies/jwt';
import jwtAppsStrategy from './strategies/jwtApps';
import jwtChallengeVerifierStrategy from './strategies/jwtChallengeVerifier';
import magicLinkStrategy from './strategies/magicLink';
import passwordStrategy from './strategies/password';
import passwordResetStrategy from './strategies/passwordReset';
import strictSessionStrategy from './strategies/strictSession';

// This plugin needs to be globally register before using the prehandlers.
const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const memberPasswordService = resolveDependency(MemberPasswordService);
  const memberRepository = resolveDependency(MemberRepository);
  const accountRepository = resolveDependency(AccountRepository);
  const itemRepository = resolveDependency(ItemRepository);

  // Mandatory registration for @fastify/passport
  await fastify
    .register(fastifySecureSession, {
      key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
      cookie: {
        domain: COOKIE_DOMAIN,
        path: '/',
        secure: PROD || STAGING,
        httpOnly: true,
        // Timeout before the session is invalidated. The user can renew the session since the timeout is not reached.
        // The session will be automatically renewed on each request.
        maxAge: SECURE_SESSION_EXPIRATION_IN_SECONDS,
      },
      // Max timeout for the session. After this time, the session is invalidated and cannot be renewed.
      // The user must re-authenticate.
      expiry: MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS,
    })
    .register(fastifyPassport.initialize())
    .register(fastifyPassport.secureSession());

  //-- Sessions Strategies --//
  strictSessionStrategy(fastifyPassport);

  //-- Password Strategies --//
  passwordStrategy(fastifyPassport, memberPasswordService, {
    propagateError: true,
  });

  //-- Magic Link Strategies (JWT) --//
  magicLinkStrategy(
    fastifyPassport,
    memberRepository,
    PassportStrategy.MobileMagicLink,
    TOKEN_PARAM,
    AUTH_TOKEN_JWT_SECRET,
    { propagateError: true },
  );
  magicLinkStrategy(
    fastifyPassport,
    memberRepository,
    PassportStrategy.WebMagicLink,
    SHORT_TOKEN_PARAM,
    JWT_SECRET,
    { propagateError: true },
  );

  //-- JWT Strategies --//
  passwordResetStrategy(fastifyPassport, memberPasswordService);
  emailChangeStrategy(fastifyPassport, memberRepository);
  jwtChallengeVerifierStrategy(fastifyPassport, accountRepository, {
    propagateError: true,
  });
  jwtStrategy(
    fastifyPassport,
    accountRepository,
    PassportStrategy.MobileJwt,
    AUTH_TOKEN_JWT_SECRET,
    {
      propagateError: true,
    },
  );
  jwtStrategy(
    fastifyPassport,
    accountRepository,
    PassportStrategy.RefreshToken,
    REFRESH_TOKEN_JWT_SECRET,
    { propagateError: false },
  );
  jwtAppsStrategy(
    fastifyPassport,
    accountRepository,
    itemRepository,
    PassportStrategy.AppsJwt,
    true,
  );
  jwtAppsStrategy(
    fastifyPassport,
    accountRepository,
    itemRepository,
    PassportStrategy.OptionalAppsJwt,
    false,
  );

  // Serialize and Deserialize user
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => {
    assertIsDefined(user.account);
    return user.account.id;
  });
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req): Promise<PassportUser> => {
    const account = await accountRepository.get(db, uuid);

    return { account: account?.toMaybeUser() };
  });
};
export default plugin;
