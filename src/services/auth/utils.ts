import jwt from 'jsonwebtoken';

import { FastifyBaseLogger } from 'fastify';

import {
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  BUILDER_HOST,
  CLIENT_HOSTS,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../utils/config';

const defaultClientHost = BUILDER_HOST;

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

export function generateAuthTokensPair(memberId: string): {
  authToken: string;
  refreshToken: string;
} {
  const [authToken, refreshToken] = [
    jwt.sign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET, {
      expiresIn: AUTH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
    jwt.sign({ sub: memberId }, REFRESH_TOKEN_JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
  ];
  return { authToken, refreshToken };
}
