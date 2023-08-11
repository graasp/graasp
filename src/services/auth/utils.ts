import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyRequest } from 'fastify';

import { Context } from '@graasp/sdk';

import {
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  CLIENT_HOSTS,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../utils/config';
import { InvalidSession, OrphanSession } from '../../utils/errors';
import MemberRepository from '../member/repository';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

const defaultClientHost = CLIENT_HOSTS.find((c) => c.name === Context.Builder);
if (!defaultClientHost) {
  throw new Error('Default Builder client host environment variable not set!');
}

const validOrigins = CLIENT_HOSTS.map((c) => c.url.origin);

export const getRedirectionUrl = (target?: string) => {
  if (!target) {
    return defaultClientHost.url.origin;
  }

  const targetUrl = new URL(target);
  if (!validOrigins.includes(targetUrl.origin)) {
    return defaultClientHost.url.origin;
  }

  return target;
};

export async function verifyMemberInSession(request: FastifyRequest) {
  const { session } = request;
  const memberId = session.get('member');

  if (!memberId) {
    throw new InvalidSession(memberId);
  }

  try {
    const member = await MemberRepository.get(memberId);
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
  const memberId = session.get('member');

  if (!memberId) return;

  // this throws if someone tries to use a fake member id
  request.member = await MemberRepository.get(memberId);
}

// for token based auth
export async function verifyMemberInAuthToken(jwtToken: string, request: FastifyRequest) {
  try {
    const { routerPath } = request;
    const refreshing = '/m/auth/refresh' === routerPath;
    const secret = refreshing ? REFRESH_TOKEN_JWT_SECRET : AUTH_TOKEN_JWT_SECRET;
    const { memberId } = jwt.verify(jwtToken, secret, {}) as jwt.JwtPayload;
    const member = await MemberRepository.get(memberId);

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
