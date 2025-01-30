import { sign } from 'jsonwebtoken';

import { FastifyBaseLogger } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import {
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  CLIENT_HOST,
  LIBRARY_HOST,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../utils/config';

const defaultClientHostOrigin = ClientManager.getInstance().getURLByContext(Context.Builder).origin;

const validOrigins = [CLIENT_HOST, LIBRARY_HOST];

export const getRedirectionUrl = (log: FastifyBaseLogger, target?: string) => {
  if (!target) {
    return defaultClientHostOrigin;
  }

  try {
    const targetUrl = new URL(target);
    if (!validOrigins.includes(targetUrl.origin)) {
      log.error(
        `redirection-url-util: Attempted to use a non valid origin  (url: ${targetUrl.toString()})`,
      );
      return defaultClientHostOrigin;
    }
  } catch {
    return defaultClientHostOrigin;
  }

  return target;
};

export function generateAuthTokensPair(memberId: string): {
  authToken: string;
  refreshToken: string;
} {
  const [authToken, refreshToken] = [
    sign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET, {
      expiresIn: AUTH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
    sign({ sub: memberId }, REFRESH_TOKEN_JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
  ];
  return { authToken, refreshToken };
}
