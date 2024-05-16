import jwt, { Secret, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger, FastifyRequest } from 'fastify';

import {
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  BUILDER_HOST,
  CLIENT_HOSTS,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../utils/config';
import { InvalidSession, OrphanSession } from '../../utils/errors';
import { MemberRepository } from '../member/repository';

// todo: duplicate?
const memberRepository = new MemberRepository();

const promisifiedJwtVerify = promisify<
  string,
  Secret,
  VerifyOptions,
  { sub: string; challenge?: string }
>(jwt.verify);
const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

const defaultClientHost = BUILDER_HOST;
const SESSION_MEMBER_ID_KEY = 'passport';

const validOrigins = CLIENT_HOSTS.map((c) => c.url.origin);

export const getRedirectionUrl = (log: FastifyBaseLogger, target?: string) => {
  if (!target) {
    return defaultClientHost.url.origin;
  }

  try {
    const targetUrl = new URL(target);
    if (!validOrigins.includes(targetUrl.origin)) {
      log.error(
        `redirection-url-util: Attempted to use a non valid origin  (url: ${targetUrl.toString()})`,
      );
      return defaultClientHost.url.origin;
    }
  } catch {
    return defaultClientHost.url.origin;
  }

  return target;
};

export async function verifyMemberInSession(request: FastifyRequest) {
  const { session } = request;
  const memberId = session.get(SESSION_MEMBER_ID_KEY);

  if (!memberId) {
    throw new InvalidSession(memberId);
  }

  try {
    const member = await memberRepository.get(memberId);
    request.member = member;
  } catch (e) {
    session.delete();
    throw new OrphanSession(memberId);
  }
}

// set member in request from session if exist
// used to get authenticated member without throwing
export async function fetchMemberInSession(request: FastifyRequest) {
  const { session } = request;
  const memberId = session.get(SESSION_MEMBER_ID_KEY);

  if (!memberId) return;

  // this throws if someone tries to use a fake member id
  request.member = await memberRepository.get(memberId);
}

// for token based auth
export async function verifyMemberInAuthToken(jwtToken: string, request: FastifyRequest) {
  try {
    const { routerPath } = request;
    const refreshing = '/m/auth/refresh' === routerPath;
    const secret = refreshing ? REFRESH_TOKEN_JWT_SECRET : AUTH_TOKEN_JWT_SECRET;
    const { sub: memberId } = await promisifiedJwtVerify(jwtToken, secret, {});
    const member = await memberRepository.get(memberId);

    if (refreshing) {
      request.memberId = memberId;
    } else {
      request.member = member;
    }

    return true;
  } catch (error) {
    const { log } = request;
    log.warn('Invalid auth token');
    return false;
  }
}

export async function generateAuthTokensPair(
  memberId: string,
): Promise<{ authToken: string; refreshToken: string }> {
  const [authToken, refreshToken] = await Promise.all([
    promisifiedJwtSign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET, {
      expiresIn: `${AUTH_TOKEN_EXPIRATION_IN_MINUTES}m`,
    }),
    promisifiedJwtSign({ sub: memberId }, REFRESH_TOKEN_JWT_SECRET, {
      expiresIn: `${REFRESH_TOKEN_EXPIRATION_IN_MINUTES}m`,
    }),
  ]);
  return { authToken, refreshToken };
}
